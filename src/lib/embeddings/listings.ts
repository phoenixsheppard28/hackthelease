import "server-only";
import { saveListingEmbedding, type StoredListing } from "../supabase/listings";
import { embedTexts } from "./openai";

const EMBEDDING_BATCH_SIZE = 100;

export async function embedMissingListings(
  listings: StoredListing[],
): Promise<void> {
  const missing = listings.filter((stored) => stored.embedding === null);

  for (let start = 0; start < missing.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = missing.slice(start, start + EMBEDDING_BATCH_SIZE);
    const embeddings = await embedTexts(
      batch.map((stored) => stored.searchableText),
    );
    await Promise.all(
      batch.map((stored, index) =>
        saveListingEmbedding(
          stored.listing.id,
          stored.textHash,
          embeddings[index],
        ),
      ),
    );
  }
}
