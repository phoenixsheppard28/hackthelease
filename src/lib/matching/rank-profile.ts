import 'server-only';
import type { HousingProfile, MatchResult } from '../contracts/housing';
import { embedMissingListings } from '../embeddings/listings';
import { embedTexts } from '../embeddings/openai';
import { listActiveListings, type StoredListing } from '../supabase/listings';
import { rankListings } from './rank';

async function withEmbeddings(listings: StoredListing[]): Promise<StoredListing[]> {
  try {
    return await embedMissingListings(listings);
  } catch (error) {
    console.error('Lazy listing embedding failed', error);
    return listings;
  }
}

async function embedLifestyle(lifestyleText: string): Promise<number[] | null> {
  if (!lifestyleText.trim()) {
    return null;
  }

  try {
    const [embedding] = await embedTexts([lifestyleText]);
    return embedding;
  } catch (error) {
    console.error('Lifestyle embedding failed', error);
    return null;
  }
}

export async function rankProfile(profile: HousingProfile): Promise<MatchResult[]> {
  const [listings, profileEmbedding] = await Promise.all([
    listActiveListings().then(withEmbeddings),
    embedLifestyle(profile.lifestyleText),
  ]);

  return rankListings(profile, listings, profileEmbedding);
}
