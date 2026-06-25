import OpenAI from "openai";

import { KNOWLEDGE_EMBEDDING_DIMENSIONS } from "../db/knowledge-schema";

export const EMBEDDING_MODEL = "text-embedding-3-small";

// OpenRouter does not serve embeddings, so embeddings use OpenAI directly.
let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set; document embeddings are unavailable.");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

// OpenAI allows large batches, but keep requests bounded to stay well under
// per-request token limits when chunks are sizeable.
const MAX_BATCH_SIZE = 96;

/**
 * Embeds an arbitrary number of texts, batching requests as needed. The
 * returned vectors are aligned to the input order.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += MAX_BATCH_SIZE) {
    const batch = texts.slice(start, start + MAX_BATCH_SIZE);
    const response = await getClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      encoding_format: "float",
    });
    for (const item of response.data) {
      vectors.push(item.embedding as number[]);
    }
  }

  return vectors;
}

/**
 * Embeds a single query string for similarity search.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const [vector] = await embedTexts([query]);
  if (!vector || vector.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
    throw new Error("Failed to generate query embedding.");
  }
  return vector;
}

/**
 * Serializes an embedding into the pgvector text literal format: "[a,b,c]".
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
