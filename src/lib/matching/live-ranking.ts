import "server-only";
import type { HousingProfile } from "@/lib/contracts/housing-profile";
import type { Weights } from "@/lib/contracts/matching-weights";
import { embedTexts } from "@/lib/embeddings/openai";
import { readListingCatalog } from "@/lib/supabase/listing-catalog";
import { matchingProfile, rankCatalog } from "./catalog-matches";
import { combineGroupMatches } from "./group-ranking";
import type { SavedProfile } from "@/lib/contracts/housing-profile";

// Slider changes reuse the same lifestyle vector; schedule and identity never enter this request.
const vectors = new Map<string, { expires: number; value: Promise<number[] | null> }>();
async function lifestyleVector(profile: HousingProfile, weights: Weights): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY || !weights.Lifestyle) return null;
  const text = matchingProfile(profile).lifestyleText;
  const cached = vectors.get(text);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = embedTexts([text]).then(([vector]) => vector).catch(() => { vectors.delete(text); return null; });
  if (vectors.size >= 50) vectors.delete(vectors.keys().next().value!);
  vectors.set(text, { expires: Date.now() + 600000, value });
  return value;
}

export async function rankLiveListings(profile: HousingProfile, weights: Weights, listingId?: string) {
  const [catalog, embedding] = await Promise.all([readListingCatalog(listingId), lifestyleVector(profile, weights)]);
  return rankCatalog(profile, weights, catalog, embedding, Boolean(listingId));
}

export async function rankLiveGroup(profiles: SavedProfile[], memberCount: number, listingId?: string) {
  if (!profiles.length) return combineGroupMatches([]);

  const catalog = await readListingCatalog(listingId);
  const results = await Promise.all(profiles.map(async ({ profile }) => {
    const groupProfile = { ...profile, roommates: memberCount - 1 };
    return rankCatalog(groupProfile, profile.weights, catalog, await lifestyleVector(groupProfile, profile.weights), Boolean(listingId));
  }));
  const combined = combineGroupMatches(results);
  if (profiles.length < memberCount) combined.notices.unshift(`${profiles.length} of ${memberCount} group members have completed a profile.`);
  return combined;
}
