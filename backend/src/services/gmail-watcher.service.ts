import { getGmailClient } from "../config/gmail.config";
import { GmailSyncState } from "../models/email.model";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

let renewalInterval: ReturnType<typeof setInterval> | null = null;

export async function startWatch(): Promise<void> {
  const gmail = getGmailClient();
  const topic = process.env.GMAIL_PUBSUB_TOPIC;
  const emailAddress = process.env.GMAIL_USER_EMAIL;

  if (!topic) {
    throw new Error("GMAIL_PUBSUB_TOPIC environment variable is not set");
  }
  if (!emailAddress) {
    throw new Error("GMAIL_USER_EMAIL environment variable is not set");
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

  await GmailSyncState.findOneAndUpdate(
    { emailAddress },
    {
      historyId,
      watchExpiration: expiration ? new Date(Number(expiration)) : null,
    },
    { upsert: true }
  );

  console.log(
    `Gmail watch registered for ${emailAddress}, historyId: ${historyId}, expires: ${expiration}`
  );
}

export function scheduleWatchRenewal(): void {
  if (renewalInterval) {
    clearInterval(renewalInterval);
  }

  renewalInterval = setInterval(async () => {
    try {
      console.log("Renewing Gmail watch...");
      await startWatch();
    } catch (err) {
      console.error("Failed to renew Gmail watch:", err);
    }
  }, SIX_DAYS_MS);
}

export function stopWatchRenewal(): void {
  if (renewalInterval) {
    clearInterval(renewalInterval);
    renewalInterval = null;
  }
}

export async function getStoredHistoryId(): Promise<string | null> {
  const emailAddress = process.env.GMAIL_USER_EMAIL;
  const state = await GmailSyncState.findOne({ emailAddress }).lean();
  return state?.historyId ?? null;
}

export async function updateStoredHistoryId(historyId: string): Promise<void> {
  const emailAddress = process.env.GMAIL_USER_EMAIL;
  await GmailSyncState.findOneAndUpdate(
    { emailAddress },
    { historyId },
    { upsert: true }
  );
}
