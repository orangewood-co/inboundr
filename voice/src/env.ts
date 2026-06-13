import dotenv from "dotenv";

// .env.local wins over .env so local development can override deployed defaults.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export interface RecordingEnv {
  bucket: string;
  region: string;
  accessKey: string;
  secret: string;
}

export const env = {
  backendUrl: (process.env.BACKEND_URL || "http://localhost:3000").replace(/\/+$/, ""),
  internalApiKey: process.env.VOICE_INTERNAL_API_KEY || "",
  agentName: process.env.VOICE_AGENT_NAME || "inboundr-voice",
  /** Optional fallback dialed number for local testing without SIP (e.g. agents playground). */
  defaultNumber: process.env.VOICE_DEFAULT_NUMBER || "",
  livekitUrl: process.env.LIVEKIT_URL || "",
  livekitApiKey: process.env.LIVEKIT_API_KEY || "",
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || "",
  sttModel: process.env.VOICE_STT_MODEL || "deepgram/nova-3",
  ttsModel: process.env.VOICE_TTS_MODEL || "cartesia/sonic-3",
  ttsVoice: process.env.VOICE_TTS_VOICE || "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
  llmModel: process.env.VOICE_LLM_MODEL || "openai/gpt-4.1",
};

/** Recording is enabled only when every S3 setting is present. */
export function recordingEnv(): RecordingEnv | null {
  const bucket = process.env.VOICE_RECORDING_S3_BUCKET || "";
  const region = process.env.VOICE_RECORDING_S3_REGION || "";
  const accessKey = process.env.VOICE_RECORDING_S3_ACCESS_KEY || "";
  const secret = process.env.VOICE_RECORDING_S3_SECRET || "";

  if (!bucket || !region || !accessKey || !secret) return null;
  return { bucket, region, accessKey, secret };
}
