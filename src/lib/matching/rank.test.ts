import { describe, expect, it } from 'vitest';
import type { HousingProfile, Listing } from '../contracts/housing';
import { demoListings } from '../fixtures/listings';
import { rankListings, type RankableListing } from './rank';

const [oxford, cabrio] = demoListings;

const baseProfile: HousingProfile = {
  budgetMonthlyPerPerson: 1200,
  minimumBeds: null,
  moveInDate: null,
  requiresAccessibleUnit: false,
  roommateCount: 1,
  preferredAmenities: [],
  lifestyleText: '',
  priorities: ['affordability', 'amenities', 'lifestyle'],
};

function rankable(listing: Listing, embedding: number[] | null = null): RankableListing {
  return { listing, isDemo: true, embedding };
}

function rankOne(profile: Partial<HousingProfile>, listing: Partial<Listing>) {
  return rankListings({ ...baseProfile, ...profile }, [rankable({ ...oxford, ...listing })]);
}

describe('rankListings firm requirements', () => {
  it('passes a listing that meets every firm requirement', () => {
    const [result] = rankOne(
      { minimumBeds: 2, moveInDate: '2027-09-01', requiresAccessibleUnit: true },
      { accessible: true },
    );

    expect(result.firmChecks).toEqual({ budget: 'pass', beds: 'pass', moveIn: 'pass', accessibility: 'pass' });
    expect(result.verificationFlags.filter((flag) => flag.startsWith('Needs verification'))).toEqual([]);
  });

  it('excludes a listing with a confirmed failure', () => {
    expect(rankOne({ minimumBeds: 3 }, {})).toEqual([]);
    expect(rankOne({ moveInDate: '2027-08-01' }, {})).toEqual([]);
    expect(rankOne({ requiresAccessibleUnit: true }, { accessible: false })).toEqual([]);
    expect(rankOne({ budgetMonthlyPerPerson: 900 }, {})).toEqual([]);
  });

  it('keeps an unknown result and flags it as needing verification', () => {
    const [result] = rankOne(
      { minimumBeds: 2, moveInDate: '2027-09-01', requiresAccessibleUnit: true },
      { accessible: null, beds: null, availableFrom: null },
    );

    expect(result.firmChecks).toMatchObject({ beds: 'unknown', moveIn: 'unknown', accessibility: 'unknown' });
    expect(result.verificationFlags).toEqual(
      expect.arrayContaining([
        'Needs verification: beds',
        'Needs verification: moveIn',
        'Needs verification: accessibility',
      ]),
    );
  });

  it('skips firm checks the profile does not ask for', () => {
    const [result] = rankOne({ budgetMonthlyPerPerson: null }, {});

    expect(result.firmChecks).toEqual({});
  });
});

describe('rankListings per-person monthly cost', () => {
  it('divides per-unit rent by the household size and adds recurring fees', () => {
    const [result] = rankOne(
      { budgetMonthlyPerPerson: 1200, roommateCount: 1 },
      { rentMin: 2200, rentMax: 2200, rentBasis: 'per_unit', recurringFeesMonthly: 50 },
    );

    expect(result.firmChecks.budget).toBe('pass');
    expect(result.supportingFacts).toContain('$1150 per person per month');
    expect(result.componentScores.affordability).toBeCloseTo(1 - 1150 / 2400);
  });

  it('fails when fees push the per-person cost over budget', () => {
    expect(rankOne({ budgetMonthlyPerPerson: 1000 }, { rentMin: 980, recurringFeesMonthly: 40 })).toEqual([]);
  });

  it('never treats an unknown rent basis as a budget match', () => {
    const [result] = rankOne({}, { rentBasis: 'unknown' });

    expect(result.firmChecks.budget).toBe('unknown');
    expect(result.componentScores.affordability).toBe(0.5);
    expect(result.verificationFlags).toEqual(
      expect.arrayContaining(['Needs verification: budget', 'Rent basis unknown']),
    );
  });

  it('does not divide per-unit rent when the roommate count is unknown', () => {
    const [result] = rankOne({ roommateCount: null }, { rentBasis: 'per_unit', rentMin: 2200, rentMax: 2200 });

    expect(result.firmChecks.budget).toBe('unknown');
    expect(result.verificationFlags).toContain('Roommate count unknown; per-unit rent not split');
  });

  it('flags unknown recurring fees and does not confirm the budget', () => {
    const [result] = rankOne({}, { recurringFeesMonthly: null });

    expect(result.firmChecks.budget).toBe('unknown');
    expect(result.verificationFlags).toContain('Recurring fees unknown');
  });
});

describe('rankListings preference evidence', () => {
  it('gives missing evidence a neutral 0.5 with an uncertain flag', () => {
    const [result] = rankOne(
      { budgetMonthlyPerPerson: null, preferredAmenities: ['gym'], lifestyleText: 'quiet' },
      {},
    );

    expect(result.componentScores).toMatchObject({ affordability: 0.5, amenities: 0.5, lifestyle: 0.5 });
    expect(result.verificationFlags).toEqual(
      expect.arrayContaining([
        'Uncertain: affordability',
        'Uncertain: amenities',
        'Uncertain: lifestyle',
        'Amenity unknown: gym',
      ]),
    );
  });

  it('never treats an unknown amenity as present', () => {
    const [result] = rankOne({ preferredAmenities: ['laundry', 'gym'] }, { amenities: { laundry: true } });

    expect(result.componentScores.amenities).toBeCloseTo(0.75);
  });

  it('scores lifestyle fit from cosine similarity', () => {
    const results = rankListings({ ...baseProfile, lifestyleText: 'quiet' }, [rankable(oxford, [0, 1])], [1, 0]);

    expect(results[0].componentScores.lifestyle).toBeCloseTo(0.5);
    expect(rankListings(baseProfile, [rankable(oxford, [2, 0])], [1, 0])[0].componentScores.lifestyle).toBe(1);
  });
});

describe('rankListings priority weights', () => {
  const profile: HousingProfile = {
    ...baseProfile,
    preferredAmenities: ['parking', 'laundry'],
    lifestyleText: 'quiet study space',
  };
  const listings = [rankable(cabrio, [0, 1]), rankable(oxford, [1, 0])];

  it('changes the ranking deterministically when the priority order changes', () => {
    const lifestyleFirst = rankListings({ ...profile, priorities: ['lifestyle', 'amenities', 'affordability'] }, listings, [1, 0]);
    const amenitiesFirst = rankListings({ ...profile, priorities: ['amenities', 'lifestyle', 'affordability'] }, listings, [1, 0]);

    expect(lifestyleFirst.map((result) => result.listingId)).toEqual(['demo-oxford-1', 'demo-cabrio-1']);
    expect(amenitiesFirst.map((result) => result.listingId)).toEqual(['demo-cabrio-1', 'demo-oxford-1']);
  });

  it('marks commute unavailable and renormalizes the remaining weights', () => {
    const [result] = rankListings(
      { ...profile, preferredAmenities: [], priorities: ['commute', 'affordability', 'lifestyle'] },
      [rankable(oxford, [1, 0])],
      [1, 0],
    );
    const affordability = 1 - 980 / 2400;

    expect(result.componentScores.commute).toBeNull();
    expect(result.skippedPriorities).toEqual(['commute']);
    expect(result.score).toBeCloseTo((0.3 * affordability + 0.2 * 1) / 0.5);
  });

  it('breaks score ties by listing id and labels demo results', () => {
    const twin = { ...oxford, id: 'demo-aaa' };
    const results = rankListings(baseProfile, [rankable(oxford), rankable(twin)]);

    expect(results.map((result) => result.listingId)).toEqual(['demo-aaa', 'demo-oxford-1']);
    expect(results[0]).toMatchObject({ isDemo: true, sourceUrls: ['https://example.com/demo/oxford-1'] });
  });
});
