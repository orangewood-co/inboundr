import { getGmailClientForAccount } from "../config/gmail.config";
import {
  GmailAccount,
  type IGmailAccount,
} from "../models/gmail-account.model";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

let renewalInterval: ReturnType<typeof setInterval> | null = null;

export async function startWatch(account: IGmailAccount): Promise<void> {
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

