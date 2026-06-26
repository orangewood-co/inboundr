import OpenAI from "openai";
import { WebSocket } from "ws";

import { getOpenAiRealtimeConfig } from "../config/telephony.config";

let client: OpenAI | null = null;

/**
 * Returns a shared OpenAI client configured with the realtime API key, project,
 * and webhook secret. Used for verifying webhooks and controlling SIP calls.
 */
export function getOpenAiClient(): OpenAI {
  if (client) return client;
  const config = getOpenAiRealtimeConfig();
  client = new OpenAI({
    apiKey: config.apiKey,
    project: config.projectId ?? undefined,
    webhookSecret: config.webhookSecret,
  });
  return client;
}

/**
 * Opens the control WebSocket for an accepted realtime call. The socket behaves
 * like any other Realtime API connection: send client events, receive server
 * events. Audio is handled by OpenAI over SIP and never flows through here.
 */
export function connectRealtimeCallSocket(callId: string): WebSocket {
  const config = getOpenAiRealtimeConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.projectId) headers["OpenAI-Project"] = config.projectId;

  return new WebSocket(
    `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`,
    { headers }
  );
}
