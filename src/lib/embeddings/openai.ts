import "server-only";
import { z } from "zod";

const EMBEDDING_MODEL = "text-embedding-3-small";

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
  });
  if (!response.ok) {
    throw new Error(
      `OpenAI embeddings request failed with status ${response.status}.`,
    );
  }

  const { data } = EmbeddingResponseSchema.parse(await response.json());
  return data
    .toSorted((a, b) => a.index - b.index)
    .map(({ embedding }) => embedding);
}
