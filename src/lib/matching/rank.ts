import type { HousingProfile, Listing, MatchResult } from '../contracts/housing';

export type RankableListing = {
  listing: Listing;
  isDemo: boolean;
  embedding: number[] | null;
};

type FirmCheck = 'pass' | 'fail' | 'unknown';
type SupportedPriority = 'affordability' | 'amenities' | 'lifestyle';

const PRIORITY_WEIGHTS = [0.5, 0.3, 0.2];
const NEUTRAL_SCORE = 0.5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function firmCheck(passes: boolean | null): FirmCheck {
  if (passes === null) {
    return 'unknown';
  }

  return passes ? 'pass' : 'fail';
}

export function cosineSimilarity(a: number[], b: number[]): number | null {
  if (a.length === 0 || a.length !== b.length) {
    return null;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index++) {
    dot += a[index] * b[index];
    normA += a[index] ** 2;
    normB += b[index] ** 2;
  }

  return normA === 0 || normB === 0 ? null : dot / Math.sqrt(normA * normB);
}

function monthlyCostPerPerson(listing: Listing, roommateCount: number | null, flags: string[]): number | null {
  if (listing.rentMin === null) {
    flags.push('Rent unknown');
    return null;
  }
  if (listing.rentBasis === 'unknown') {
    flags.push('Rent basis unknown');
    return null;
  }
  if (listing.rentBasis === 'per_unit' && roommateCount === null) {
    flags.push('Roommate count unknown; per-unit rent not split');
    return null;
  }

  const rent = listing.rentBasis === 'per_unit' ? listing.rentMin / (1 + roommateCount!) : listing.rentMin;
  if (listing.recurringFeesMonthly === null) {
    flags.push('Recurring fees unknown');
  }

  return rent + (listing.recurringFeesMonthly ?? 0);
}

function budgetCheck(cost: number | null, feesKnown: boolean, budget: number): FirmCheck {
  if (cost === null) {
    return 'unknown';
  }
  if (cost > budget) {
    return 'fail';
  }

  return feesKnown ? 'pass' : 'unknown';
}

function firmChecks(profile: HousingProfile, listing: Listing, cost: number | null): MatchResult['firmChecks'] {
  const checks: MatchResult['firmChecks'] = {};

  if (profile.budgetMonthlyPerPerson !== null) {
    checks.budget = budgetCheck(cost, listing.recurringFeesMonthly !== null, profile.budgetMonthlyPerPerson);
  }
  if (profile.minimumBeds !== null) {
    checks.beds = firmCheck(listing.beds === null ? null : listing.beds >= profile.minimumBeds);
  }
  if (profile.moveInDate !== null) {
    checks.moveIn = firmCheck(listing.availableFrom === null ? null : listing.availableFrom <= profile.moveInDate);
  }
  if (profile.requiresAccessibleUnit) {
    checks.accessibility = firmCheck(listing.accessible);
  }

  return checks;
}

function affordabilityScore(cost: number | null, budget: number | null): number | null {
  if (cost === null || budget === null) {
    return null;
  }

  return cost === 0 ? 1 : clamp01(1 - cost / (2 * budget));
}

function amenitiesScore(preferred: string[], amenities: Listing['amenities'], flags: string[]): number | null {
  const amenityByName = new Map(Object.entries(amenities).map(([name, present]) => [name.trim().toLowerCase(), present]));
  const scores = preferred.map((name) => {
    const present = amenityByName.get(name.trim().toLowerCase());
    if (present === null || present === undefined) {
      flags.push(`Amenity unknown: ${name}`);
      return null;
    }

    return present ? 1 : 0;
  });

  if (scores.every((score) => score === null)) {
    return null;
  }

  return scores.reduce<number>((sum, score) => sum + (score ?? NEUTRAL_SCORE), 0) / scores.length;
}

function lifestyleScore(profileEmbedding: number[] | null, listingEmbedding: number[] | null): number | null {
  const similarity = profileEmbedding && listingEmbedding ? cosineSimilarity(profileEmbedding, listingEmbedding) : null;

  return similarity === null ? null : clamp01((similarity + 1) / 2);
}

function supportingFacts(listing: Listing, cost: number | null): string[] {
  const presentAmenities = Object.entries(listing.amenities)
    .filter(([, present]) => present === true)
    .map(([name]) => name);

  return [
    cost !== null && `$${Math.round(cost)} per person per month`,
    listing.beds !== null && `${listing.beds} bedrooms`,
    listing.availableFrom !== null && `Available from ${listing.availableFrom}`,
    presentAmenities.length > 0 && `Amenities: ${presentAmenities.join(', ')}`,
    ...listing.features,
  ].filter((fact): fact is string => typeof fact === 'string');
}

function matchListing(
  profile: HousingProfile,
  { listing, isDemo, embedding }: RankableListing,
  profileEmbedding: number[] | null,
): MatchResult | null {
  const flags: string[] = [];
  const cost = monthlyCostPerPerson(listing, profile.roommateCount, flags);
  const checks = firmChecks(profile, listing, cost);
  if (Object.values(checks).includes('fail')) {
    return null;
  }

  for (const [name, result] of Object.entries(checks)) {
    if (result === 'unknown') {
      flags.push(`Needs verification: ${name}`);
    }
  }

  const rawScores: Record<SupportedPriority, number | null> = {
    affordability: affordabilityScore(cost, profile.budgetMonthlyPerPerson),
    amenities: amenitiesScore(profile.preferredAmenities, listing.amenities, flags),
    lifestyle: lifestyleScore(profileEmbedding, embedding),
  };
  const scores = {} as Record<SupportedPriority, number>;
  for (const priority of Object.keys(rawScores) as SupportedPriority[]) {
    if (rawScores[priority] === null) {
      flags.push(`Uncertain: ${priority}`);
    }
    scores[priority] = rawScores[priority] ?? NEUTRAL_SCORE;
  }

  const weighted = profile.priorities
    .map((priority, index) => ({ priority, weight: PRIORITY_WEIGHTS[index] }))
    .filter((entry): entry is { priority: SupportedPriority; weight: number } => entry.priority !== 'commute');
  const totalWeight = weighted.reduce((sum, { weight }) => sum + weight, 0);
  const score = weighted.reduce((sum, { priority, weight }) => sum + weight * scores[priority], 0) / totalWeight;

  return {
    listingId: listing.id,
    score: clamp01(score),
    componentScores: { ...scores, commute: null },
    firmChecks: checks,
    supportingFacts: supportingFacts(listing, cost),
    sourceUrls: listing.sources.map((source) => source.url),
    verificationFlags: flags,
    skippedPriorities: profile.priorities.filter((priority) => priority === 'commute'),
    isDemo,
  };
}

export function rankListings(
  profile: HousingProfile,
  listings: RankableListing[],
  profileEmbedding: number[] | null = null,
): MatchResult[] {
  return listings
    .map((listing) => matchListing(profile, listing, profileEmbedding))
    .filter((result): result is MatchResult => result !== null)
    .sort((a, b) => b.score - a.score || (a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0));
}
