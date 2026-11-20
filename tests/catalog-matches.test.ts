import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankCatalog } from '../src/lib/matching/catalog-matches.ts';
import { previewProfile } from '../src/lib/matching/preview-profile.ts';
import { rentText, rentBasisText } from '../src/lib/contracts/listing-match.ts';
import type { CatalogListing } from '../src/lib/supabase/listing-catalog.ts';
import { combineGroupMatches } from '../src/lib/matching/group-ranking.ts';

const profile = { ...previewProfile, budget: 1100 };
const weights = profile.weights;
function entry(overrides = {}): CatalogListing {
  return {
    isDemo: false, embedding: null, images: ['https://example.com/photo.jpg'], refreshedAt: '2026-11-20T00:00:00Z',
    listing: {
      id: 'listing-1', address: '123 Main St, Ann Arbor, MI', unit: '2', rentMin: 2000, rentMax: 2000,
      rentBasis: 'per_unit', recurringFeesMonthly: null, beds: 2, availableFrom: null, accessible: null,
      amenities: {}, features: [], description: 'A home.', contact: { name: 'Leasing', email: 'leasing@example.com', phone: '7345550100' },
      sources: [{ url: 'https://example.com/listing', fetchedAt: '2026-11-20T00:00:00Z' }], isActive: true,
      ...overrides,
    },
  };
}

test('preserves advertised rent basis and splits per-unit rent only for the estimate', () => {
  const { matches: [home] } = rankCatalog(profile, weights, [entry()], null);
  assert.equal(home.rent, 2000);
  assert.equal(rentText(home), '$2,000');
  assert.equal(rentBasisText(home), ' / unit / month');
  assert.deepEqual(home.perPersonRent, { min: 1000, max: 1000 });
  assert.equal(home.firmChecks.budget, 'unknown');
  assert.ok(home.verificationFlags.includes('Recurring fees unknown'));
  assert.equal(home.contact?.email, 'leasing@example.com');
  assert.equal(home.sourceUrl, 'https://example.com/listing');
});

test('filters confirmed budget and bedroom failures; detail remains viewable without a match score', () => {
  for (const row of [entry({ rentMin: 4000, rentMax: 4000 }), entry({ beds: 1 })]) {
    assert.equal(rankCatalog(profile, weights, [row], null).matches.length, 0);
    const detail = rankCatalog(profile, weights, [row], null, true).matches[0];
    assert.equal(detail.score, null);
    assert.match(detail.verificationFlags[0], /does not meet/);
  }
});

test('unknown rent, basis, bedrooms and transit never turn into confirmed matches', () => {
  const [home] = rankCatalog(profile, weights, [entry({ rentBasis: 'unknown', beds: null })], null).matches;
  assert.equal(home.perPersonRent, null);
  assert.equal(home.firmChecks.budget, 'unknown');
  assert.equal(home.firmChecks.beds, 'unknown');
  assert.ok(home.destinations.every(place => place.minutes === null));
  assert.equal(home.components.find(component => component.label === 'Location')?.score, null);
  assert.equal(home.components.find(component => component.label === 'Lifestyle')?.score, null);
});

test('rent ranges retain uncertainty and group budget uses household size', () => {
  const [home] = rankCatalog({ ...profile, basis: 'Our whole group', budget: 2200 }, weights, [entry({ rentMin: 1800, rentMax: 2800 })], null).matches;
  assert.equal(home.firmChecks.budget, 'unknown');
  assert.deepEqual(home.perPersonRent, { min: 900, max: 1400 });
  assert.equal(rentText(home), '$1,800–$2,800');
});

test('four sliders reweight supported evidence and can change order', () => {
  const cheap = entry({ id: 'cheap', rentMin: 1200, rentMax: 1200, beds: null });
  const fitting = entry({ id: 'fitting', rentMin: 2000, rentMax: 2000, beds: 2 });
  const byBudget = rankCatalog(profile, { Location: 0, Budget: 100, 'Home fit': 0, Lifestyle: 0 }, [cheap, fitting], null);
  const byFit = rankCatalog(profile, { Location: 0, Budget: 0, 'Home fit': 100, Lifestyle: 0 }, [cheap, fitting], null);
  assert.equal(byBudget.matches[0].id, 'cheap');
  assert.equal(byFit.matches[0].id, 'fitting');
  const onlyUnsupported = rankCatalog(profile, { Location: 100, Budget: 0, 'Home fit': 0, Lifestyle: 100 }, [cheap, fitting], null);
  assert.ok(onlyUnsupported.matches.every(home => home.score === null));
});

test('semantic score is included only with usable listing and profile vectors', () => {
  const row = { ...entry(), embedding: [1, 0] };
  const [home] = rankCatalog(profile, { Location: 0, Budget: 0, 'Home fit': 0, Lifestyle: 100 }, [row], [1, 0]).matches;
  assert.equal(home.score, 100);
});

test('renewal flags reach personal and group listings without changing match scores', () => {
  const row = entry();
  row.availabilityReport = { reportedAt: '2026-11-20T12:00:00Z', source: 'landlord_email', status: 'tenants_renewing', leaseStart: '2027-08-01', leaseEnd: '2028-08-01' };
  const personal = rankCatalog(profile, weights, [row], null);
  assert.deepEqual(personal.matches[0].availabilityReport, row.availabilityReport);
  assert.equal(personal.matches[0].score, rankCatalog(profile, weights, [entry()], null).matches[0].score);
  assert.deepEqual(combineGroupMatches([personal, personal]).matches[0].availabilityReport, row.availabilityReport);
});
