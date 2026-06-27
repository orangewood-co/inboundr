export interface OpenAiRealtimeConfig {
  apiKey: string;
  projectId: string | null;
  webhookSecret: string;
  model: string;
}

export interface VobizConfig {
  authId: string;
  authToken: string;
  apiBaseUrl: string;
}

export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2";
export const DEFAULT_VOBIZ_API_BASE_URL = "https://api.vobiz.ai/api/v1";

/**
 * Reads the OpenAI realtime/SIP configuration. The webhook secret is required
 * for verifying inbound `realtime.call.incoming` events; the API key is reused
 * from the existing embeddings setup.
 */
export function getOpenAiRealtimeConfig(): OpenAiRealtimeConfig {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required for voice support");
  }
  const webhookSecret = process.env.OPENAI_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) {
    throw new Error("OPENAI_WEBHOOK_SECRET environment variable is required for voice support");
  }
  return {
    apiKey,
    projectId: process.env.OPENAI_PROJECT_ID?.trim() || null,
    webhookSecret,
    model: process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL,
  };
}

export function isVoiceSupportConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_WEBHOOK_SECRET);
}

/**
 * Reads the Vobiz REST credentials used to list and download call recordings
 * from the Recordings API. Throws when the integration is used without config.
 */
export function getVobizConfig(): VobizConfig {
  const authId = process.env.VOBIZ_AUTH_ID ?? "";
  const authToken = process.env.VOBIZ_AUTH_TOKEN ?? "";
  if (!authId || !authToken) {
    throw new Error("VOBIZ_AUTH_ID and VOBIZ_AUTH_TOKEN environment variables are required");
  }
  return {
    authId,
    authToken,
    apiBaseUrl: (process.env.VOBIZ_API_BASE_URL?.trim() || DEFAULT_VOBIZ_API_BASE_URL).replace(/\/+$/, ""),
  };
}

export function isVobizConfigured(): boolean {
  return Boolean(process.env.VOBIZ_AUTH_ID && process.env.VOBIZ_AUTH_TOKEN);
}
