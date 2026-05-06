import fs from "fs";
import path from "path";
import { google, type gmail_v1 } from "googleapis";
import { JWT } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

let gmailClient: gmail_v1.Gmail | null = null;

export function getGmailClient(): gmail_v1.Gmail {
  if (gmailClient) return gmailClient;

  const keyFilePath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(process.cwd(), "service-account.json");
  const userEmail = process.env.GMAIL_USER_EMAIL;

  if (!userEmail) {
    throw new Error("GMAIL_USER_EMAIL environment variable is not set");
  }

  const keyFileContent = JSON.parse(fs.readFileSync(keyFilePath, "utf-8"));

  const auth = new JWT({
    email: keyFileContent.client_email,
    key: keyFileContent.private_key,
    scopes: SCOPES,
    subject: userEmail,
  });

  gmailClient = google.gmail({ version: "v1", auth });
  return gmailClient;
}
