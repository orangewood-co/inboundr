export const DEFAULT_WHATSAPP_GRAPH_API_VERSION = "v23.0";

/**
 * Customer-service window: after the customer's last message, Meta only allows
 * free-form (non-template) business replies for 24 hours.
 */
export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Meta caps text message bodies at 4096 characters. */
export const WHATSAPP_TEXT_MAX_LENGTH = 4096;

/** Inbound media larger than this is not mirrored into S3. */
export const WHATSAPP_MEDIA_MAX_BYTES = 100 * 1024 * 1024;

export interface WhatsAppPlatformConfig {
  graphApiVersion: string;
  /**
   * App secret of the platform-owned Meta app. Optional: organizations that
   * connect their own Meta app supply a per-account secret instead.
   */
  appSecret: string | null;
  /** Platform-level webhook verify token (same optionality as the app secret). */
  verifyToken: string | null;
  /** Platform-owned Meta app id; used for template media uploads when the account has none. */
  appId: string | null;
}

export function getWhatsAppPlatformConfig(): WhatsAppPlatformConfig {
  return {
    graphApiVersion:
      process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || DEFAULT_WHATSAPP_GRAPH_API_VERSION,
    appSecret: process.env.WHATSAPP_APP_SECRET?.trim() || null,
    verifyToken:
      process.env.WHATSAPP_VERIFY_TOKEN?.trim() ||
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ||
      null,
    appId: process.env.WHATSAPP_APP_ID?.trim() || null,
  };
}

export function whatsAppGraphBaseUrl(): string {
  return `https://graph.facebook.com/${getWhatsAppPlatformConfig().graphApiVersion}`;
}
