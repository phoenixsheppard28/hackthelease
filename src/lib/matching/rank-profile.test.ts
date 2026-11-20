import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HousingProfile } from '../contracts/housing';
import * as openai from '../embeddings/openai';
import { demoListings } from '../fixtures/listings';
import * as listings from '../supabase/listings';
import { rankProfile } from './rank-profile';

vi.mock('server-only', () => ({}));
vi.mock('../supabase/listings');
vi.mock('../embeddings/openai');

const profile: HousingProfile = {
  budgetMonthlyPerPerson: 1200,
  minimumBeds: null,
  moveInDate: null,
  requiresAccessibleUnit: false,
  roommateCount: 1,
  preferredAmenities: [],
  lifestyleText: 'quiet study space',
  priorities: ['lifestyle', 'affordability', 'amenities'],
};

const [oxford, cabrio] = demoListings;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listings.listActiveListings).mockResolvedValue([
    { listing: oxford, isDemo: true, searchableText: 'oxford', textHash: 'hash-oxford', embedding: [1, 0] },
    { listing: cabrio, isDemo: true, searchableText: 'cabrio', textHash: 'hash-cabrio', embedding: null },
  ]);
});

describe('rankProfile', () => {
  it('embeds only the lifestyle text and scores unembedded listings as uncertain', async () => {
    vi.mocked(openai.embedTexts).mockResolvedValue([[1, 0]]);

    const response = await rankProfile(profile);

    expect(openai.embedTexts).toHaveBeenCalledExactlyOnceWith(['quiet study space']);
    expect(listings.saveListingEmbedding).not.toHaveBeenCalled();
    expect(response.degraded).toEqual([]);
    const cabrioMatch = response.matches.find((match) => match.listingId === 'demo-cabrio-1');
    expect(cabrioMatch?.componentScores.lifestyle).toBe(0.5);
    expect(cabrioMatch?.verificationFlags).toContain('Uncertain: lifestyle');
    expect(response.matches.find((match) => match.listingId === 'demo-oxford-1')?.componentScores.lifestyle).toBe(1);
  });

  it('reports a degraded lifestyle score and logs only the message when embedding fails', async () => {
    vi.mocked(openai.embedTexts).mockRejectedValue(new Error('OPENAI_API_KEY is not set.'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await rankProfile(profile);

    expect(response.degraded).toEqual(['lifestyle']);
    expect(response.matches.every((match) => match.componentScores.lifestyle === 0.5)).toBe(true);
    expect(consoleError).toHaveBeenCalledExactlyOnceWith('Lifestyle embedding failed: OPENAI_API_KEY is not set.');
    consoleError.mockRestore();
  });

  it('skips the embedding call for blank lifestyle text without degrading', async () => {
    const response = await rankProfile({ ...profile, lifestyleText: '  ' });

    expect(openai.embedTexts).not.toHaveBeenCalled();
    expect(response.degraded).toEqual([]);
  });
});
