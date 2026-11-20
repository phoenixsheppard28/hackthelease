import { describe, expect, it } from 'vitest';
import { demoListings } from '../fixtures/listings';

describe('ListingSchema', () => {
  it('parses two demo properties with explicit rent basis', async () => {
    const { ListingSchema } = await import('./housing');

    expect(demoListings).toHaveLength(2);
    expect(new Set(demoListings.map((listing) => listing.address)).size).toBe(2);
    expect(ListingSchema.array().parse(demoListings)).toEqual(demoListings);
    expect(demoListings.map((listing) => listing.rentBasis)).toEqual([
      'per_person',
      'per_unit',
    ]);
  });

  it('rejects malformed rent data', async () => {
    const { ListingSchema } = await import('./housing');
    const listing = demoListings[0];

    expect(ListingSchema.safeParse({ ...listing, rentMin: -1 }).success).toBe(false);
    expect(ListingSchema.safeParse({ ...listing, rentMin: '980' }).success).toBe(false);
    expect(ListingSchema.safeParse({ ...listing, rentMax: 900 }).success).toBe(false);
    expect(ListingSchema.safeParse({ ...listing, rentBasis: undefined }).success).toBe(false);
  });

  it('keeps missing rent evidence explicit', async () => {
    const { ListingSchema } = await import('./housing');

    expect(
      ListingSchema.safeParse({
        ...demoListings[0],
        rentMin: null,
        rentMax: null,
        rentBasis: 'unknown',
        recurringFeesMonthly: null,
      }).success,
    ).toBe(true);
  });
});

describe('shared contracts', () => {
  it('rejects duplicate ranked priorities', async () => {
    const { HousingProfileSchema } = await import('./housing');
    const profile = {
      budgetMonthlyPerPerson: 1200,
      minimumBeds: 2,
      moveInDate: '2027-08-20',
      requiresAccessibleUnit: false,
      roommateCount: 1,
      preferredAmenities: ['laundry'],
      lifestyleText: 'I study near North Campus.',
      priorities: ['affordability', 'amenities', 'lifestyle'],
    };

    expect(HousingProfileSchema.safeParse(profile).success).toBe(true);
    expect(
      HousingProfileSchema.safeParse({
        ...profile,
        priorities: ['affordability', 'affordability', 'lifestyle'],
      }).success,
    ).toBe(false);
  });

  it('rejects invalid match scores and negative crawl counts', async () => {
    const { MatchResultSchema, CrawlRunStatusSchema } = await import('./housing');
    const match = {
      listingId: demoListings[0].id,
      score: 0.8,
      componentScores: { affordability: 0.9, amenities: 0.5, lifestyle: 0.7, commute: null },
      firmChecks: { budget: 'pass' },
      supportingFacts: ['Monthly rent is per person.'],
      sourceUrls: [demoListings[0].sources[0].url],
      verificationFlags: [],
      skippedPriorities: [],
    };
    const run = {
      runId: 'demo-run',
      status: 'running',
      startedAt: '2026-11-19T20:00:00Z',
      finishedAt: null,
      counts: {
        discovered: 2,
        processed: 1,
        newListings: 1,
        updatedListings: 0,
        rentChanges: 0,
        failedPages: 0,
      },
      sources: [],
    };

    expect(MatchResultSchema.safeParse(match).success).toBe(true);
    expect(MatchResultSchema.safeParse({ ...match, score: 1.2 }).success).toBe(false);
    expect(CrawlRunStatusSchema.safeParse(run).success).toBe(true);
    expect(
      CrawlRunStatusSchema.safeParse({
        ...run,
        counts: { ...run.counts, rentChanges: undefined },
      }).success,
    ).toBe(false);
    expect(
      CrawlRunStatusSchema.safeParse({
        ...run,
        counts: { ...run.counts, failedPages: -1 },
      }).success,
    ).toBe(false);
  });
});
