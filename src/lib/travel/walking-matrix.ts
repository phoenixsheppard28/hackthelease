import 'server-only';
import { z } from 'zod';
import { destinations, type CampusHub } from './destinations';
import type { DestinationWalk, WalkingStatus } from './types';
import { reserveWalkingRequest } from './request-budget';

const elementSchema = z.object({
  // Google omits default-valued protobuf fields, including index zero.
  originIndex: z.number().int().nonnegative().default(0),
  destinationIndex: z.number().int().nonnegative().default(0),
  status: z.object({ code: z.number().int().default(0) }).default({ code: 0 }),
  condition: z.string().optional(),
  duration: z.string().regex(/^\d+(?:\.\d+)?s$/).optional(),
  distanceMeters: z.number().int().nonnegative().optional(),
});
const MAX_ORIGINS = 250;
export const addressKey = (address: string) => address.trim().replace(/\s+/g, ' ').toLowerCase();

export function emptyWalking(hubs: readonly string[], status: WalkingStatus): DestinationWalk[] {
  return hubs.map(name => ({ name, minutes: null, distanceMeters: null, status, checkedAt: null }));
}

export async function walkingMatrix(addresses: string[], hubs: readonly string[], signal?: AbortSignal, addressOverrides: Record<string, string> = {}): Promise<Map<string, DestinationWalk[]>> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const unique = [...new Map(addresses.map(address => [addressKey(address), address.trim()])).entries()];
  const output = new Map(unique.map(([id]) => [id, emptyWalking(hubs, key ? 'unavailable' : 'not_configured')]));
  if (!key || !unique.length || !hubs.length || hubs.length >= 50) return output;
  const deadline = AbortSignal.timeout(45_000);
  const eligible = unique.filter(([id, address], index) => {
    if (index >= MAX_ORIGINS) { output.set(id, emptyWalking(hubs, 'limited')); return false; }
    if (address.length < 5 || address.length > 200 || !/\d/.test(address)) { output.set(id, emptyWalking(hubs, 'invalid_address')); return false; }
    return true;
  });
  const batchSize = Math.min(40, 50 - hubs.length, Math.floor(625 / hubs.length));
  for (let offset = 0; offset < eligible.length; offset += batchSize) {
    signal?.throwIfAborted();
    if (deadline.aborted) return output;
    const batch = eligible.slice(offset, offset + batchSize);
    for (let attempt = 0; attempt < 2; attempt++) {
      signal?.throwIfAborted();
      if (deadline.aborted) return output;
      const release = reserveWalkingRequest(batch.length * hubs.length);
      if (!release) { batch.forEach(([id]) => output.set(id, emptyWalking(hubs, 'limited'))); break; }
      let retry = false;
      try {
        const timeout = AbortSignal.timeout(12_000);
        const response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
          method: 'POST', cache: 'no-store', signal: AbortSignal.any([deadline, timeout, ...(signal ? [signal] : [])]),
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,distanceMeters,duration' },
          body: JSON.stringify({ origins: batch.map(([, address]) => ({ waypoint: { address } })),
            destinations: hubs.map(name => ({ waypoint: { address: addressOverrides[name] ?? destinations[name as CampusHub]?.address } })), travelMode: 'WALK' }),
        });
        if (response.status === 429 || response.status === 401 || response.status === 403) {
          // Stop subsequent batches rather than multiplying a quota/configuration failure.
          const status = response.status === 429 ? 'limited' : 'unavailable';
          eligible.slice(offset).forEach(([id]) => output.set(id, emptyWalking(hubs, status)));
          return output;
        }
        if (!response.ok) { retry = response.status >= 500 && attempt === 0; }
        else {
          const data: unknown = await response.json();
          if (!Array.isArray(data)) break;
          const checkedAt = new Date().toISOString();
          for (const raw of data) {
            const parsed = elementSchema.safeParse(raw);
            if (!parsed.success) continue; // One malformed element must not discard other routes.
            const element = parsed.data;
            const origin = batch[element.originIndex];
            const name = hubs[element.destinationIndex];
            if (!origin || !name) continue;
            let result: DestinationWalk = { name, minutes: null, distanceMeters: null, checkedAt, status: 'unavailable' };
            if (element.status.code === 3 || element.status.code === 5) result.status = 'invalid_address';
            else if (element.status.code === 0 && element.condition === 'ROUTE_NOT_FOUND') result.status = 'no_route';
            else if (element.status.code === 0 && element.condition === 'ROUTE_EXISTS' && element.duration !== undefined) {
              const seconds = Number.parseFloat(element.duration);
              if (Number.isFinite(seconds)) result = { ...result, status: 'ok', minutes: Math.ceil(seconds / 60), distanceMeters: element.distanceMeters ?? null };
            }
            output.get(origin[0])![element.destinationIndex] = result;
          }
        }
      } catch {
        signal?.throwIfAborted();
        if (deadline.aborted) return output;
        retry = attempt === 0;
      } finally { release(); }
      if (!retry) break;
      // A single bounded retry for transient errors; aborted requests never retry.
      await new Promise<void>(resolve => setTimeout(resolve, 300));
      signal?.throwIfAborted();
    }
  }
  return output;
}
