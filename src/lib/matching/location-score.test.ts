import { describe, expect, it } from 'vitest';
import { locationScore, reweightMatches, walkingSummary } from './location-score';
import { previewProfile } from './preview-profile';
import { rankCatalog } from './catalog-matches';
import type { DestinationWalk } from '../travel/types';
import type { CatalogListing } from '../supabase/listing-catalog';
import type { Weights } from '../contracts/matching-weights';

const entry: CatalogListing = {
  isDemo: false, embedding: null, images: [], refreshedAt: '2026-11-20T00:00:00Z',
  listing: { id: 'near', address: '123 Main St, Ann Arbor, MI', unit: null, rentMin: 1000, rentMax: 1000,
    rentBasis: 'per_person', recurringFeesMonthly: 0, beds: 2, availableFrom: null, accessible: null,
    amenities: {}, features: [], description: null, contact: null, sources: [{ url: 'https://example.com/home', fetchedAt: '2026-11-20T00:00:00Z' }], isActive: true },
};
const weights: Weights = { Location: 50, Budget: 35, 'Home fit': 10, Lifestyle: 5 };
const walks = (minutes: number): DestinationWalk[] => previewProfile.hubs.map(name => ({ name, minutes, status: 'ok', distanceMeters: 400, checkedAt: null }));

describe('location score and reranking', () => {
  it('prefers shorter walks and penalizes only explicitly exceeded limits', () => {
    const profile = { ...previewProfile, walk: {} };
    expect(locationScore(walks(5), profile)).toBeGreaterThan(locationScore(walks(25), profile)!);
    const limited = { ...profile, walk: { [profile.hubs[0]]: 10 } };
    expect(locationScore(walks(5), limited)).toBe(locationScore(walks(5), profile));
    expect(locationScore(walks(25), limited)).toBeLessThan(locationScore(walks(25), profile)!);
    expect(walkingSummary({ destinations: walks(25) }, {})).toBe('25 min average walk to your places');
    expect(walkingSummary({ destinations: walks(25) }, limited.walk)).toBe('Within 0 of 1 walking preferences');
  });

  it('never scores partial or missing evidence as a zero-minute walk', () => {
    const places = walks(10);
    places[1] = { ...places[1], minutes: null, status: 'unavailable' };
    expect(locationScore(places, previewProfile)).toBeNull();
    expect(locationScore(walks(10).slice(1), previewProfile)).toBeNull();
    expect(walkingSummary({ destinations: places }, {})).toBe('Walking estimates incomplete');
  });

  it('uses visit frequency for confirmed calendar places', () => {
    const calendarDestinations = [{ name: 'Chem Building', address: '930 N University Ave, Ann Arbor, MI', count: 40 }];
    const profile = { ...previewProfile, calendarDestinations, walk: {} };
    const manual = walks(20);
    const near = [...manual, { ...manual[0], name: 'Calendar · Chem Building', minutes: 5 }];
    const far = [...manual, { ...manual[0], name: 'Calendar · Chem Building', minutes: 40 }];

    expect(locationScore(near, profile)).toBeGreaterThan(locationScore(far, profile)!);
    expect(locationScore(near, profile)).toBeGreaterThan(locationScore(near, { ...profile, calendarDestinations: [{ ...calendarDestinations[0], count: 20 }] })!);
    expect(locationScore(manual, profile)).toBeNull();
  });

  it('changes order locally, preserves inputs, and makes all-zero weights unscored', () => {
    const near = rankCatalog(previewProfile, weights, [entry], null).matches[0];
    near.components.find(item => item.label === 'Location')!.score = 95;
    near.components.find(item => item.label === 'Budget')!.score = 40;
    const cheap = { ...near, id: 'cheap', components: near.components.map(item => ({ ...item, score: item.label === 'Location' ? 20 : item.label === 'Budget' ? 90 : item.score })) };
    const homes = [near, cheap];
    const snapshot = structuredClone(homes);
    expect(reweightMatches(homes, { ...weights, Location: 100, Budget: 0 })[0].id).toBe('near');
    expect(reweightMatches(homes, { ...weights, Location: 0, Budget: 100 })[0].id).toBe('cheap');
    expect(reweightMatches(homes, { Location: 0, Budget: 0, 'Home fit': 0, Lifestyle: 0 }).every(home => home.score === null)).toBe(true);
    expect(homes).toEqual(snapshot);
  });

  it('sorts incomplete routes last only when Location matters; keeps hard failures unscored', () => {
    const home = rankCatalog(previewProfile, weights, [entry], null).matches[0];
    const complete = { ...home, id: 'complete', components: home.components.map(item => ({ ...item, score: 10 })) };
    expect(reweightMatches([home, complete], weights)[0].id).toBe('complete');
    expect(reweightMatches([home, complete], { ...weights, Location: 0 })[0].id).toBe('near');
    const failed = rankCatalog(previewProfile, weights, [{ ...entry, listing: { ...entry.listing, beds: 0 } }], null, true).matches[0];
    failed.components[0].score = 100;
    expect(reweightMatches([failed], weights)[0].score).toBeNull();
  });
});
