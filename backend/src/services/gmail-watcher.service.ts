import { getGmailClientForAccount, getGoogleOAuthClient } from "../config/gmail.config";
import { decryptSecret } from "../lib/crypto";
import {
  GmailAccount,
  type IGmailAccount,
} from "../models/gmail-account.model";
import { Organization } from "../models/organization.model";
import { hasEffectiveFeature } from "./entitlement.service";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

let renewalInterval: ReturnType<typeof setInterval> | null = null;

export interface GmailUnlinkResult {
  accountId: string;
  emailAddress: string;
  watchStopped: boolean;
  tokenRevoked: boolean;
  errorMessage: string | null;
}

async function isQuotationEnabledForAccount(account: IGmailAccount): Promise<boolean> {
  if (!account.organizationId) return false;

  const organization = await Organization.findById(account.organizationId)
    .select("planSlug enabledFeatures disabledFeatures")
    .lean();

  return Boolean(organization && hasEffectiveFeature(organization, "rfq"));
}

export async function startWatch(account: IGmailAccount): Promise<void> {
  if (!(await isQuotationEnabledForAccount(account))) {
    throw new Error("Quotations feature is not enabled for this organization");
  }

  const gmail = await getGmailClientForAccount(account);
  const topic = process.env.GMAIL_PUBSUB_TOPIC;

  if (!topic) {
    throw new Error("GMAIL_PUBSUB_TOPIC environment variable is not set");
  }

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: topic,
      labelIds: ["INBOX"],
    },
  });

  const historyId = res.data.historyId;
  const expiration = res.data.expiration;

  if (!historyId) {
    throw new Error("Gmail watch response missing historyId");
  }

  await GmailAccount.updateOne(
    { _id: account._id },
    {
      historyId,
      watchExpiration: expiration ? new Date(Number(expiration)) : null,
      status: "connected",
      errorMessage: null,
    },
  );

  console.log(
    `Gmail watch registered for ${account.emailAddress}, historyId: ${historyId}, expires: ${expiration}`
  );
}

export async function stopWatch(account: IGmailAccount): Promise<void> {
  const gmail = await getGmailClientForAccount(account);
  await gmail.users.stop({ userId: "me" });

  await GmailAccount.updateOne(
    { _id: account._id },
    {
      historyId: null,
      watchExpiration: null,
    }
  );

  console.log(`Gmail watch stopped for ${account.emailAddress}`);
}

async function revokeGmailToken(account: IGmailAccount): Promise<boolean> {
  const encryptedToken = account.accessToken ?? account.refreshToken;
  if (!encryptedToken) return false;

  const oauth = getGoogleOAuthClient();
  await oauth.revokeToken(decryptSecret(encryptedToken));
  return true;
}

export async function unlinkGmailAccount(
  account: IGmailAccount,
  reason = "Gmail account disconnected"
): Promise<GmailUnlinkResult> {
  const errors: string[] = [];
  let watchStopped = false;
  let tokenRevoked = false;

  if (account.status === "connected" || account.historyId || account.watchExpiration) {
    try {
      await stopWatch(account);
      watchStopped = true;
    } catch (err: any) {
      const message = err?.message || "Failed to stop Gmail watch";
      console.warn(`Failed to stop Gmail watch for ${account.emailAddress}:`, err);
      errors.push(message);
    }
  }

  try {
    tokenRevoked = await revokeGmailToken(account);
  } catch (err: any) {
    const message = err?.message || "Failed to revoke Gmail token";
    console.warn(`Failed to revoke Gmail token for ${account.emailAddress}:`, err);
    errors.push(message);
  }

  const errorMessage = errors.length > 0 ? `${reason}: ${errors.join("; ")}` : null;
  await GmailAccount.updateOne(
    { _id: account._id },
    {
      status: "revoked",
      accessToken: null,
      refreshToken: null,
      historyId: null,
      watchExpiration: null,
      errorMessage,
    }
  );

  return {
    accountId: account._id.toString(),
    emailAddress: account.emailAddress,
    watchStopped,
    tokenRevoked,
    errorMessage,
  };
}

export async function unlinkGmailAccountsForOrganization(
  organizationId: string,
  reason = "Quotations feature disabled"
): Promise<GmailUnlinkResult[]> {
  const accounts = await GmailAccount.find({
    organizationId,
    status: { $in: ["connected", "expired", "error"] },
  });

  const results: GmailUnlinkResult[] = [];
  for (const account of accounts) {
    results.push(await unlinkGmailAccount(account, reason));
  }

  return results;
}

export async function startWatchForAccountId(accountId: string): Promise<void> {
  const account = await GmailAccount.findById(accountId);
  if (!account) throw new Error("Gmail account not found");
  await startWatch(account);
}

export async function startWatchesForConnectedAccounts(): Promise<void> {
  const accounts = await GmailAccount.find({ status: "connected" });
  for (const account of accounts) {
    try {
      await startWatch(account);
    } catch (err: any) {
      console.error(`Failed to start Gmail watch for ${account.emailAddress}:`, err);
      await GmailAccount.updateOne(
        { _id: account._id },
        { status: "error", errorMessage: err.message || "Failed to start watch" }
      );
    }
  }
}

export function scheduleWatchRenewal(): void {
  if (renewalInterval) {
    clearInterval(renewalInterval);
  }

  renewalInterval = setInterval(async () => {
    try {
      console.log("Renewing Gmail watches...");
      await startWatchesForConnectedAccounts();
    } catch (err) {
      console.error("Failed to renew Gmail watches:", err);
    }
  }, SIX_DAYS_MS);
}

export function stopWatchRenewal(): void {
  if (renewalInterval) {
    clearInterval(renewalInterval);
    renewalInterval = null;
  }
}

