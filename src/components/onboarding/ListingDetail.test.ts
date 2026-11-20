import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingDetail } from './ListingDetail';
import { useListingEvidence } from './useListingEvidence';
import { previewProfile } from '@/lib/matching/preview-profile';
import { rankCatalog } from '@/lib/matching/catalog-matches';
import { demoListings } from '@/lib/fixtures/listings';

const state = vi.hoisted(() => ({ group: true, home: {} as unknown }));
vi.mock('./useListingEvidence', () => ({ useListingEvidence: vi.fn() }));
vi.mock('./TravelTimes', () => ({ TravelTimes: () => null }));
vi.mock('./Availability', () => ({ Availability: () => null }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    isSuccess: true, isPending: false, isError: false,
    data: queryKey[0] === 'housing-group' ? { group: state.group ? { id: 'group-1', name: 'Our group', members: [{ id: 'student-1' }] } : null }
      : queryKey[0] === 'group-saves' ? { ids: [] } : { matches: [state.home] },
  }),
}));

const home = rankCatalog(previewProfile, previewProfile.weights, [{
  listing: demoListings[0], isDemo: false, embedding: null, images: [], refreshedAt: '2026-11-20',
}], null).matches[0];
const personalHome = { ...home, destinations: previewProfile.hubs.map((name, index) => ({
  name, status: 'ok' as const, minutes: 5 + index, distanceMeters: 400, checkedAt: null,
})) };
function evidence(status: 'ready' | 'loading' | 'error') {
  vi.mocked(useListingEvidence).mockReturnValue({
    data: status === 'ready' ? { matches: [personalHome] } : undefined,
    isPending: status === 'loading', isError: status === 'error', refetch: vi.fn(),
  } as unknown as ReturnType<typeof useListingEvidence>);
}
function render(profile = previewProfile) {
  return renderToStaticMarkup(React.createElement(ListingDetail, {
    listingId: home.id, profileId: 'student-1',
    context: { profile, weights: profile.weights, query: '', homeType: 'All homes', view: 'homes' },
  }));
}
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.clearAllMocks();
  state.group = true;
  state.home = { ...home, score: 88, components: [], destinations: [], scoreCoverage: { scored: 2, total: 2 } };
  evidence('ready');
});
afterEach(() => vi.unstubAllGlobals());

describe('personal destinations on a group listing', () => {
  it('shows approved Calendar places and their route evidence beside the manual places', () => {
    const profile = { ...previewProfile, calendarDestinations: [{ name: 'Chemistry Building', address: '930 N University Ave', count: 14 }] };
    vi.mocked(useListingEvidence).mockReturnValue({ data: { matches: [{ ...personalHome, destinations: [...personalHome.destinations, { name: 'Calendar · Chemistry Building', status: 'ok', minutes: 12, distanceMeters: 900, checkedAt: null }] }] }, isPending: false, isError: false } as unknown as ReturnType<typeof useListingEvidence>);
    const html = render(profile);
    for (const name of profile.hubs) expect(html).toContain(name);
    expect(html).toContain('Chemistry Building');
    expect(html).toContain('14 scheduled visits in your imported schedule');
    expect(html).toContain('12 min');
    expect(html).toContain('88% match');
    expect(html).toContain('href="/?home=1"');
  });

  it('keeps an approved Calendar destination visible when its route is unavailable', () => {
    const html = render({ ...previewProfile, calendarDestinations: [{ name: 'Chemistry Building', address: '930 N University Ave', count: 1 }] });
    expect(html).toContain('Chemistry Building');
    expect(html).toContain('1 scheduled visit in your imported schedule');
    expect(html).toContain('Not available');
  });
  it('shows all three personal walking estimates while preserving the group score', () => {
    const html = render();
    expect(useListingEvidence).toHaveBeenCalledWith('student-1', previewProfile, home.id, true);
    expect(html).toContain('Your places, from here');
    for (const name of previewProfile.hubs) expect(html).toContain(name);
    for (const minutes of [5, 6, 7]) expect(html).toContain(`${minutes} min`);
    expect(html).toContain('88% match');
    expect(html).toContain('Our group');
  });

  it.each(['loading', 'error'] as const)('keeps destination names visible when personal routes are %s', status => {
    evidence(status);
    const html = render();
    for (const name of previewProfile.hubs) expect(html).toContain(name);
    expect(html).toContain(status === 'loading' ? 'Checking…' : 'Retry walking times');
    expect(html).toContain('88% match');
  });

  it('keeps the same three destinations available outside a group', () => {
    state.group = false;
    const html = render();
    for (const name of previewProfile.hubs) expect(html).toContain(name);
    expect(html).toContain('5 min');
    expect(html).not.toContain('Group location scoring is not connected yet.');
  });
});
