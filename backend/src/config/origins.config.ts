const isProduction = process.env.NODE_ENV === "production";

function requiredOrigin(name: string, localDefault: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;

  if (isProduction) {
    throw new Error(`${name} environment variable must be set in production`);
  }

  return localDefault;
}

export const frontendOrigin = requiredOrigin("FRONTEND_ORIGIN", "http://localhost:5173");
export const apiOrigin = requiredOrigin("API_ORIGIN", "http://localhost:3000");
export const embedOrigin = requiredOrigin("EMBED_ORIGIN", "http://localhost:5175");
export const landingOrigin = requiredOrigin("LANDING_ORIGIN", "http://localhost:5174");

export const gmailOAuthRedirectUri =
  process.env.GMAIL_OAUTH_REDIRECT_URI?.trim() || `${apiOrigin}/api/v1/gmail/callback`;
