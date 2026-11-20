"use client";

import { useQuery } from '@tanstack/react-query';
import { walkingStatusText, type DestinationWalk } from '@/lib/travel/types';
import type { TravelEstimates } from '@/lib/travel/estimate';

export function DestinationTime({ origin, destination, place, loading, limit }: {
  origin: string; destination?: string; place?: DestinationWalk; loading: boolean; limit?: number;
}) {
  const available = place?.status === 'ok' && place.minutes !== null;
  const needsBus = Boolean(available && place.minutes! > 30 && destination);
  const transit = useQuery<{ routes: TravelEstimates }>({
    queryKey: ['destination-bus', origin, destination], enabled: needsBus,
    staleTime: 5 * 60_000, gcTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/travel-times', { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin, destination, mode: 'bus' }) });
      if (!response.ok) throw new Error('Bus estimate unavailable');
      return response.json();
    },
  });
  const bus = needsBus ? transit.data?.routes?.bus : null;
  return <>
    <strong>{bus ? `${bus.durationMinutes} min by bus` : available ? `${place.minutes} min` : loading ? 'Checking…' : 'Not available'}</strong>
    <p>{bus ? 'Bus trip · departing now' : available
      ? `walk${place.distanceMeters !== null ? ` · ${(place.distanceMeters / 1000).toFixed(1)} km` : ''}`
      : loading ? 'Finding a walking route' : walkingStatusText(place?.status ?? 'unavailable')}</p>
    {needsBus && !bus && <p>{transit.isPending ? 'Checking bus time…' : transit.isError ? 'Bus estimate unavailable; showing walk' : 'No bus route found; showing walk'}</p>}
    {bus && <small>Walking alternative: {place!.minutes} min. </small>}
    <small>{limit === undefined ? 'No walking limit set' : !available ? `Your preference: ${limit} min` : place.minutes! <= limit ? `Within your ${limit} min preference` : `${place.minutes! - limit} min over your ${limit} min walking preference`}</small>
  </>;
}
