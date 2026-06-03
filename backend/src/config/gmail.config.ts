import { google, type gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { GmailAccount, type IGmailAccount } from "../models/gmail-account.model";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { gmailOAuthRedirectUri } from "./origins.config";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export function getGoogleOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }

  return new google.auth.OAuth2(clientId, clientSecret, gmailOAuthRedirectUri);
}

export function getGmailAuthUrl(state: string): string {
  return getGoogleOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function getGmailClientForAccount(
  account: IGmailAccount
): Promise<gmail_v1.Gmail> {
  const oauth = getGoogleOAuthClient();
  oauth.setCredentials({
    access_token: account.accessToken
      ? decryptSecret(account.accessToken)
      : undefined,
    refresh_token: decryptSecret(account.refreshToken),
    expiry_date: account.tokenExpiry?.getTime(),
  });

  oauth.on("tokens", async (tokens) => {
    const update: Record<string, unknown> = {};
    if (tokens.access_token) update.accessToken = encryptSecret(tokens.access_token);
    if (tokens.refresh_token) update.refreshToken = encryptSecret(tokens.refresh_token);
    if (tokens.expiry_date) update.tokenExpiry = new Date(tokens.expiry_date);

    if (Object.keys(update).length > 0) {
      await GmailAccount.updateOne({ _id: account._id }, { $set: update });
    }
  });

  return google.gmail({ version: "v1", auth: oauth });
}

export async function exchangeGmailCode(code: string): Promise<{
  accessToken: string | null;
  refreshToken: string;
  scope: string[];
  tokenExpiry: Date | null;
}> {
  const oauth = getGoogleOAuthClient();
  const { tokens } = await oauth.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Disconnect the app in Google Account permissions and try again."
    );
  }

  return {
    accessToken: tokens.access_token ? encryptSecret(tokens.access_token) : null,
    refreshToken: encryptSecret(tokens.refresh_token),
    scope: tokens.scope?.split(" ").filter(Boolean) ?? GMAIL_SCOPES,
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

export async function getGmailProfileEmail(tokens: {
  accessToken: string | null;
  refreshToken: string;
  tokenExpiry: Date | null;
}): Promise<string> {
  const oauth = getGoogleOAuthClient();
  oauth.setCredentials({
    access_token: tokens.accessToken ? decryptSecret(tokens.accessToken) : undefined,
    refresh_token: decryptSecret(tokens.refreshToken),
    expiry_date: tokens.tokenExpiry?.getTime(),
  });

  const gmail = google.gmail({ version: "v1", auth: oauth });
  const profile = await gmail.users.getProfile({ userId: "me" });
  if (!profile.data.emailAddress) {
    throw new Error("Could not read Gmail profile email address");
  }
  return profile.data.emailAddress;
}
