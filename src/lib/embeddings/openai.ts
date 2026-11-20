import "server-only";
import { z } from "zod";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const REQUEST_TIMEOUT_MS = 10_000;

const EmbeddingResponseSchema = z.object({
  data: z.array(
    z.object({ index: z.number().int(), embedding: z.array(z.number()) }),
  ),
});

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI embeddings request failed with status ${response.status}.`,
    );
  }

  const parsed = EmbeddingResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("OpenAI embeddings response has an unexpected shape.");
  }

  const mismatch = new Error(
    "OpenAI embeddings response does not match the request.",
  );
  if (parsed.data.data.length !== texts.length) {
    throw mismatch;
  }

  const embeddings: number[][] = [];
  for (const { index, embedding } of parsed.data.data) {
    if (
      index < 0 ||
      index >= texts.length ||
      embeddings[index] ||
      embedding.length !== EMBEDDING_DIMENSIONS
    ) {
      throw mismatch;
    }
    embeddings[index] = embedding;
  }

  return embeddings;
}
