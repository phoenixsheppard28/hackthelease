import 'server-only';
import { saveListingEmbedding, type StoredListing } from '../supabase/listings';
import { embedTexts } from './openai';

export async function embedMissingListings(listings: StoredListing[]): Promise<StoredListing[]> {
  const missing = listings.filter((stored) => stored.embedding === null);
  if (missing.length === 0) {
    return listings;
  }

  const embeddings = await embedTexts(missing.map((stored) => stored.searchableText));
  const embeddingById = new Map(missing.map((stored, index) => [stored.listing.id, embeddings[index]]));
  await Promise.all(
    missing.map((stored) => saveListingEmbedding(stored.listing.id, stored.textHash, embeddingById.get(stored.listing.id)!)),
  );

  return listings.map((stored) => ({ ...stored, embedding: stored.embedding ?? embeddingById.get(stored.listing.id)! }));
}
