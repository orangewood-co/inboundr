import { env } from "./env.js";

export interface VoiceAgentConfig {
  enabled: boolean;
  businessName: string;
  greeting: string;
  businessInfo: string;
  extraInstructions: string;
}

export interface VoiceConfigResponse {
  organizationId: string;
  organizationName: string;
  config: VoiceAgentConfig;
}

export interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  at: string;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: T | null }> {
  const response = await fetch(`${env.backendUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": env.internalApiKey,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    return { status: response.status, data: null };
  }

  return { status: response.status, data: (await response.json()) as T };
}

/** Resolve the dialed number to an organization and its agent config. Returns null when unassigned. */
export async function fetchVoiceConfig(dialedNumber: string): Promise<VoiceConfigResponse | null> {
  try {
    const { data } = await request<VoiceConfigResponse>(
      "GET",
      `/api/v1/internal/voice/config?number=${encodeURIComponent(dialedNumber)}`
    );
    return data;
  } catch (err) {
    console.error("Failed to fetch voice config:", err);
    return null;
  }
}

export async function createCallRecord(input: {
  organizationId: string;
  callerNumber: string;
  dialedNumber: string;
  roomName: string;
  recordingKey?: string;
}): Promise<string | null> {
  try {
    const { data } = await request<{ callId: string }>("POST", "/api/v1/internal/voice/calls", input);
    return data?.callId ?? null;
  } catch (err) {
    console.error("Failed to create call record:", err);
    return null;
  }
}

export async function finalizeCallRecord(
  callId: string,
  input: {
    transcript: TranscriptEntry[];
    status: "completed" | "failed";
    recordingKey?: string;
  }
): Promise<void> {
  try {
    await request("PATCH", `/api/v1/internal/voice/calls/${encodeURIComponent(callId)}`, input);
  } catch (err) {
    console.error("Failed to finalize call record:", err);
  }
}

export interface ProductSearchResult {
  status: string;
  matches: Array<{
    brand: string | null;
    description: string | null;
    code: string | null;
    price: number | null;
  }>;
}

export async function searchProducts(input: {
  organizationId: string;
  query: string;
}): Promise<ProductSearchResult | null> {
  try {
    const { data } = await request<ProductSearchResult>(
      "POST",
      "/api/v1/internal/voice/product-search",
      { ...input, limit: 5 }
    );
    return data;
  } catch (err) {
    console.error("Product search failed:", err);
    return null;
  }
}
