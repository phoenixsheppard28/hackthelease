import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { HousingProfile } from '../contracts/housing-profile';
import type { ListingMatchesResponse } from '../contracts/listing-match';

export function evidenceKey(profileId: string, profile: HousingProfile, listingId?: string) {
  return ['listing-evidence', profileId, profile, listingId ?? 'all'] as const;
}

// Ephemeral data for the active browsing flow only. Never persisted to web
// storage or Supabase. A full reload fetches fresh routes. The shortlist and
// detail use the same snapshot during navigation, with no background refetches.
export function listingEvidenceOptions(client: QueryClient, profileId: string, profile: HousingProfile, listingId?: string) {
  const shortlist = listingId ? client.getQueryData<ListingMatchesResponse>(evidenceKey(profileId, profile)) : undefined;
  const selected = shortlist?.matches.find(home => home.id === listingId);
  return queryOptions<ListingMatchesResponse>({
    queryKey: evidenceKey(profileId, profile, listingId),
    initialData: selected && shortlist ? { ...shortlist, matches: [selected] } : undefined,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/matches', { method: 'POST', signal, cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, weights: profile.weights, ...(listingId ? { listingId } : {}) }) });
      if (!response.ok) throw new Error(response.status === 404 ? 'This listing is no longer available.' : 'Could not load matches. Please try again.');
      return response.json();
    },
  });
}
