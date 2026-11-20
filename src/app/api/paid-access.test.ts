import { beforeEach, expect, it, vi } from 'vitest';
import { currentStudent } from '@/lib/supabase/auth';
import { rankLiveListings } from '@/lib/matching/live-ranking';
import { rankProfile } from '@/lib/matching/rank-profile';
import { estimateTravel } from '@/lib/travel/estimate';
import { previewProfile } from '@/lib/matching/preview-profile';
import { matchingProfile } from '@/lib/matching/catalog-matches';
import { POST as matches } from './matches/route';
import { POST as rank } from './rank/route';
import { POST as travel } from './travel-times/route';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/auth', () => ({ currentStudent: vi.fn() }));
vi.mock('@/lib/matching/live-ranking', () => ({ rankLiveListings: vi.fn() }));
vi.mock('@/lib/matching/rank-profile', () => ({ rankProfile: vi.fn() }));
vi.mock('@/lib/travel/estimate', () => ({ estimateTravel: vi.fn() }));

const request = (body: unknown) => new Request('http://localhost/api/test', { method: 'POST', body: JSON.stringify(body) });
const endpoints = [
  { name: 'matches', handler: matches, body: { profile: previewProfile, weights: previewProfile.weights } },
  { name: 'rank', handler: rank, body: matchingProfile(previewProfile) },
  { name: 'travel', handler: travel, body: { origin: '1107 S University Ave', destination: '500 S State St' } },
];
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(currentStudent).mockResolvedValue(null);
});

it.each(endpoints)('rejects signed-out $name requests before making paid calls', async ({ handler, body }) => {
  expect((await handler(request(body))).status).toBe(401);
  expect(rankLiveListings).not.toHaveBeenCalled();
  expect(rankProfile).not.toHaveBeenCalled();
  expect(estimateTravel).not.toHaveBeenCalled();
});

it.each(endpoints)('fails closed if authentication is unavailable for $name', async ({ handler, body }) => {
  vi.mocked(currentStudent).mockRejectedValue(new Error('Auth is not configured'));
  expect((await handler(request(body))).status).toBe(503);
  expect(rankLiveListings).not.toHaveBeenCalled();
  expect(rankProfile).not.toHaveBeenCalled();
  expect(estimateTravel).not.toHaveBeenCalled();
});

it('allows authenticated matching requests', async () => {
  vi.mocked(currentStudent).mockResolvedValue({ id: 'student-1', email: 'test@example.com' });
  vi.mocked(rankLiveListings).mockResolvedValue({ matches: [], totalListings: 0, notices: [] });
  vi.mocked(rankProfile).mockResolvedValue({ matches: [], degraded: [] });
  expect((await matches(request(endpoints[0].body))).status).toBe(200);
  expect((await rank(request(endpoints[1].body))).status).toBe(200);
  expect(rankLiveListings).toHaveBeenCalledOnce();
  expect(rankProfile).toHaveBeenCalledOnce();
});
