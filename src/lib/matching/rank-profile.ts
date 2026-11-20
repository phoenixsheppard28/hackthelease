import 'server-only';
import type { HousingProfile, MatchResult } from '../contracts/housing';
import { embedTexts } from '../embeddings/openai';
import { listActiveListings } from '../supabase/listings';
import { rankListings } from './rank';

export type RankResponse = { matches: MatchResult[]; degraded: 'lifestyle'[] };

async function embedLifestyle(lifestyleText: string): Promise<{ embedding: number[] | null; failed: boolean }> {
  if (!lifestyleText.trim()) {
    return { embedding: null, failed: false };
  }

  try {
    const [embedding] = await embedTexts([lifestyleText]);
    return { embedding, failed: false };
  } catch (error) {
    console.error(`Lifestyle embedding failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return { embedding: null, failed: true };
  }
}

export async function rankProfile(profile: HousingProfile): Promise<RankResponse> {
  const [listings, lifestyle] = await Promise.all([
    listActiveListings(),
    embedLifestyle(profile.lifestyleText),
  ]);

  return {
    matches: rankListings(profile, listings, lifestyle.embedding),
    degraded: lifestyle.failed ? ['lifestyle'] : [],
  };
}
