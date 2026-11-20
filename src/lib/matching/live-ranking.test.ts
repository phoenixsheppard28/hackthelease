import { afterEach, expect, it, vi } from 'vitest';
import { rankLiveListings } from './live-ranking';
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
