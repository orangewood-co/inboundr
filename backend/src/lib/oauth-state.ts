import { createHmac, randomUUID, timingSafeEqual } from "crypto";

interface GmailOAuthState {
  userId: string;
  organizationId?: string;
  nonce: string;
  exp: number;
}

function getStateSecret(): string {
  return process.env.OAUTH_STATE_SECRET || process.env.TOKEN_ENCRYPTION_SECRET || "";
}

export function createGmailOAuthState(userId: string, organizationId?: string): string {
  const secret = getStateSecret();
  if (!secret) throw new Error("OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_SECRET must be set");

  const payload: GmailOAuthState = {
    userId,
    organizationId,
    nonce: randomUUID(),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyGmailOAuthState(state: string): GmailOAuthState {
  const secret = getStateSecret();
  if (!secret) throw new Error("OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_SECRET must be set");

  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) throw new Error("Invalid OAuth state");

  const expected = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf-8")
  ) as GmailOAuthState;
  if (payload.exp < Date.now()) throw new Error("OAuth state expired");

  return payload;
}
