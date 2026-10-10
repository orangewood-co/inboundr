import type { Request, Response } from "express";
import { getGmailAuthUrl, exchangeGmailCode, getGmailProfileEmail } from "../config/gmail.config";
import {
  GMAIL_ACCOUNT_PURPOSES,
  GmailAccount,
  type GmailAccountPurpose,
} from "../models/gmail-account.model";
import { Organization } from "../models/organization.model";
import { createGmailOAuthState, verifyGmailOAuthState } from "../lib/oauth-state";
import { startWatch, unlinkGmailAccount } from "../services/gmail-watcher.service";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { frontendOrigin } from "../config/origins.config";
import { hasEffectiveFeature, hasMailboxFeature } from "../services/entitlement.service";
import { sanitizeComposedHtml } from "../services/email-reply.service";

/**
 * Keeps a (re)connected inbox pointed at a feature the organization actually
 * has, so it never silently ingests mail that nothing processes.
 */
function purposeForOrganization(
  organization: Parameters<typeof hasEffectiveFeature>[0],
  current: GmailAccountPurpose | null
): GmailAccountPurpose {
  const quotations = hasEffectiveFeature(organization, "rfq");
  const support = hasEffectiveFeature(organization, "support");
  if (current === "both" && quotations && support) return "both";
  if (current === "support" && support) return "support";
  if (current === "quotations" && quotations) return "quotations";
  return quotations ? "quotations" : "support";
}

export async function connectGmail(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const state = createGmailOAuthState(authReq.user.id, organization._id.toString());
    res.json({ url: getGmailAuthUrl(state) });
  } catch (err: any) {
    console.error("Failed to create Gmail auth URL:", err);
    res.status(500).json({ error: err.message || "Failed to start Gmail connection" });
  }
}

export async function gmailCallback(req: Request, res: Response): Promise<void> {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    if (!code || !state) {
      res.redirect(`${frontendOrigin}/settings?gmail=error`);
      return;
    }

    const { userId, organizationId } = verifyGmailOAuthState(state);
    const organization = organizationId
      ? await Organization.findById(organizationId)
          .select("planSlug enabledFeatures disabledFeatures")
          .lean()
      : null;

    if (!organization || !hasMailboxFeature(organization)) {
      res.redirect(`${frontendOrigin}/settings?gmail=disabled`);
      return;
    }

    const tokens = await exchangeGmailCode(code);
    const emailAddress = (await getGmailProfileEmail(tokens)).toLowerCase();

    const existing = await GmailAccount.findOne({ userId, emailAddress }).select("purpose").lean();
    const account = await GmailAccount.findOneAndUpdate(
      { userId, emailAddress },
      {
        userId,
        ...(organizationId ? { organizationId } : {}),
        emailAddress,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        scope: tokens.scope,
        tokenExpiry: tokens.tokenExpiry,
        status: "connected",
        errorMessage: null,
        purpose: purposeForOrganization(organization, existing?.purpose ?? null),
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await startWatch(account);
    res.redirect(`${frontendOrigin}/settings?gmail=connected`);
  } catch (err) {
    console.error("Gmail OAuth callback failed:", err);
    res.redirect(`${frontendOrigin}/settings?gmail=error`);
  }
}

export async function listGmailAccounts(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const accounts = await GmailAccount.find({
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .select("-accessToken -refreshToken")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ accounts });
  } catch (err) {
    console.error("Failed to list Gmail accounts:", err);
    res.status(500).json({ error: "Failed to fetch Gmail accounts" });
  }
}

export async function updateGmailSignature(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const raw = (req.body ?? {}).signatureHtml;

    if (raw !== null && typeof raw !== "string") {
      res.status(400).json({ error: "Signature must be a string or null" });
      return;
    }

    const sanitized =
      typeof raw === "string" && raw.trim() ? sanitizeComposedHtml(raw) : null;

    const account = await GmailAccount.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: authReq.user.id,
        organizationId: organization._id,
      },
      { signatureHtml: sanitized },
      { returnDocument: "after" }
    )
      .select("-accessToken -refreshToken")
      .lean();

    if (!account) {
      res.status(404).json({ error: "Gmail account not found" });
      return;
    }

    res.json({ account });
  } catch (err) {
    console.error("Failed to update Gmail signature:", err);
    res.status(500).json({ error: "Failed to update signature" });
  }
}

/**
 * Inboxes are connected per user but their purpose decides where the whole
 * organization's inbound mail lands, so only admins may change it.
 */
export async function updateGmailPurpose(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const purpose = (req.body ?? {}).purpose as GmailAccountPurpose;

    if (!GMAIL_ACCOUNT_PURPOSES.includes(purpose)) {
      res.status(400).json({ error: "Purpose must be quotations, support, or both" });
      return;
    }
    const needsQuotations = purpose === "quotations" || purpose === "both";
    const needsSupport = purpose === "support" || purpose === "both";
    if (needsQuotations && !hasEffectiveFeature(organization, "rfq")) {
      res.status(400).json({ error: "Quotations is not enabled for this organization" });
      return;
    }
    if (needsSupport && !hasEffectiveFeature(organization, "support")) {
      res.status(400).json({ error: "Support is not enabled for this organization" });
      return;
    }

    const account = await GmailAccount.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: authReq.user.id,
        organizationId: organization._id,
      },
      { purpose },
      { returnDocument: "after" }
    )
      .select("-accessToken -refreshToken")
      .lean();

    if (!account) {
      res.status(404).json({ error: "Gmail account not found" });
      return;
    }

    res.json({ account });
  } catch (err) {
    console.error("Failed to update Gmail purpose:", err);
    res.status(500).json({ error: "Failed to update inbox purpose" });
  }
}

export async function disconnectGmailAccount(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const account = await GmailAccount.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    });

    if (!account) {
      res.status(404).json({ error: "Gmail account not found" });
      return;
    }

    await unlinkGmailAccount(account);

    res.json({ message: "Gmail account disconnected" });
  } catch (err) {
    console.error("Failed to disconnect Gmail account:", err);
    res.status(500).json({ error: "Failed to disconnect Gmail account" });
  }
}
