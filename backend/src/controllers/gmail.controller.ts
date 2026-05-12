import type { Request, Response } from "express";
import { google } from "googleapis";
import { getGmailAuthUrl, exchangeGmailCode, getGmailProfileEmail } from "../config/gmail.config";
import { GmailAccount } from "../models/gmail-account.model";
import { createGmailOAuthState, verifyGmailOAuthState } from "../lib/oauth-state";
import { startWatch } from "../services/gmail-watcher.service";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { decryptSecret } from "../lib/crypto";

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

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
    const tokens = await exchangeGmailCode(code);
    const emailAddress = (await getGmailProfileEmail(tokens)).toLowerCase();

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
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
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

    try {
      const oauth = new google.auth.OAuth2();
      if (account.accessToken) {
        await oauth.revokeToken(decryptSecret(account.accessToken));
      }
    } catch (err) {
      console.warn(`Failed to revoke Gmail token for ${account.emailAddress}:`, err);
    }

    await GmailAccount.updateOne(
      { _id: account._id },
      { status: "revoked", accessToken: null, errorMessage: null }
    );

    res.json({ message: "Gmail account disconnected" });
  } catch (err) {
    console.error("Failed to disconnect Gmail account:", err);
    res.status(500).json({ error: "Failed to disconnect Gmail account" });
  }
}
