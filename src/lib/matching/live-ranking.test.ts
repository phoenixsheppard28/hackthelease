import { afterEach, expect, it, vi } from 'vitest';
import { rankLiveGroup, rankLiveListings } from './live-ranking';
import { readListingCatalog } from '../supabase/listing-catalog';
import { walkingMatrix, emptyWalking, addressKey } from '../travel/walking-matrix';
import { previewProfile } from './preview-profile';
import { demoListings } from '../fixtures/listings';

vi.mock('server-only', () => ({}));
vi.mock('../supabase/listing-catalog', () => ({ readListingCatalog: vi.fn() }));
vi.mock('../travel/walking-matrix', async importOriginal => ({ ...await importOriginal<typeof import('../travel/walking-matrix')>(), walkingMatrix: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('filters firm failures before routing and retains homes with route failures', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const valid = demoListings[0];
  const excluded = { ...valid, id: 'too-expensive', address: '200 Other St', rentMin: 9000, rentMax: 9000 };
  vi.mocked(readListingCatalog).mockResolvedValue([valid, excluded].map(listing => ({ listing, isDemo: false, embedding: null, images: [], refreshedAt: '2026-11-20' })));
  vi.mocked(walkingMatrix).mockResolvedValue(new Map([[addressKey(valid.address), emptyWalking(previewProfile.hubs, 'unavailable')]]));
  const result = await rankLiveListings(previewProfile, previewProfile.weights);
  expect(walkingMatrix).toHaveBeenCalledExactlyOnceWith([valid.address], previewProfile.hubs, undefined);
  expect(result.matches).toHaveLength(1);
  expect(result.matches[0].destinations.every(place => place.minutes === null)).toBe(true);
  expect(result.matches[0].verificationFlags).toContain('Walking estimates incomplete; location needs verification.');
});

it.each([{ memberCount: 2, bedrooms: 3, minimum: 3 }, { memberCount: 4, bedrooms: 2, minimum: 4 }])('keeps explicit bedroom needs and actual group size when merging group matching: %j', async ({ memberCount, bedrooms, minimum }) => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const rows = [minimum - 1, minimum].map(beds => ({
    listing: { ...demoListings[0], id: `beds-${beds}`, beds }, isDemo: false, embedding: null, images: [], refreshedAt: '2026-11-20',
  }));
  vi.mocked(readListingCatalog).mockResolvedValue(rows);
  const result = await rankLiveGroup([{ id: 'member-profile', profile: { ...previewProfile, bedrooms } }], memberCount);
  expect(result.matches.map(home => home.id)).toEqual([`beds-${minimum}`]);
  expect(result.matches[0].scoreCoverage).toEqual({ scored: 1, total: 1 });
  expect(walkingMatrix).not.toHaveBeenCalled();
});
