import "server-only";
import type { HousingProfile } from "@/lib/contracts/housing-profile";
import type { Weights } from "@/lib/contracts/matching-weights";
import { embedTexts } from "@/lib/embeddings/openai";
import { readListingCatalog } from "@/lib/supabase/listing-catalog";
import { matchingProfile, rankCatalog } from "./catalog-matches";
import { addressKey, emptyWalking, walkingMatrix } from "../travel/walking-matrix";
import { locationScore, reweightMatches, walkingSummary } from "./location-score";

// Slider changes reuse the same lifestyle vector; schedule and identity never enter this request.
const vectors = new Map<string, { expires: number; value: Promise<number[] | null> }>();
async function lifestyleVector(profile: HousingProfile): Promise<number[] | null> {
  // Load category evidence once even when its initial slider is zero.
  if (!process.env.OPENAI_API_KEY) return null;
  const text = matchingProfile(profile).lifestyleText;
  const cached = vectors.get(text);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = embedTexts([text]).then(([vector]) => vector).catch(() => { vectors.delete(text); return null; });
  if (vectors.size >= 50) vectors.delete(vectors.keys().next().value!);
  vectors.set(text, { expires: Date.now() + 600000, value });
  return value;
}

export async function rankLiveListings(profile: HousingProfile, weights: Weights, listingId?: string, signal?: AbortSignal) {
  const [catalog, embedding] = await Promise.all([readListingCatalog(listingId), lifestyleVector(profile)]);
  signal?.throwIfAborted();
  const result = rankCatalog(profile, weights, catalog, embedding, Boolean(listingId));
  // Firm filters run before routing, so excluded homes never consume route elements.
  const walking = await walkingMatrix(result.matches.map(home => home.address), profile.hubs, signal);
  const homes = result.matches.map(home => {
    const places = walking.get(addressKey(home.address)) ?? emptyWalking(profile.hubs, 'unavailable');
    const score = locationScore(places, profile);
    return { ...home, destinations: places,
      components: home.components.map(component => component.label === 'Location' ? { ...component, score } : component),
      reasons: [...home.reasons, walkingSummary({ destinations: places }, profile.walk)],
      verificationFlags: [...home.verificationFlags, ...(score === null ? ['Walking estimates incomplete; location needs verification.'] : [])],
    };
  });
  const incomplete = homes.filter(home => home.destinations.some(place => place.status !== 'ok')).length;
  const notices = [...result.notices,
    'Location uses walking time to your three destinations equally. Shorter walks score higher; going over an optional walking preference adds a penalty. Driving, buses, weather, and building opening hours are not included.',
    ...(incomplete ? [`${incomplete} homes have incomplete walking estimates. When Location matters, these appear after homes with complete walking estimates; their scores exclude Location.`] : []),
  ];
  return { ...result, matches: reweightMatches(homes, weights), notices };
}
