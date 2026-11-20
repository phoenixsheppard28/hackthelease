import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { walkingMatrix, addressKey } from './walking-matrix';
import { reserveWalkingRequest } from './request-budget';

vi.mock('server-only', () => ({}));
vi.mock('./request-budget', () => ({ reserveWalkingRequest: vi.fn(() => () => {}) }));
const hubs = ['Hatcher Library', 'Michigan Union', 'Ross'] as const;
const address = '123 Main St, Ann Arbor, MI';
const fetchMock = vi.fn<typeof fetch>();
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const ok = { condition: 'ROUTE_EXISTS', duration: '301s', distanceMeters: 410 };

beforeEach(() => {
  vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-only');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.mocked(reserveWalkingRequest).mockReset().mockImplementation(() => () => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('walking matrix', () => {
  it('maps unordered indices, accepts omitted zero indices, and deduplicates addresses', async () => {
    fetchMock.mockResolvedValue(reply([{ ...ok, destinationIndex: 2 }, ok, { ...ok, destinationIndex: 1, duration: '0s', distanceMeters: 0 }]));
    const result = await walkingMatrix([address, ' 123   Main St, Ann Arbor, MI '], hubs);
    expect(result.size).toBe(1);
    expect(result.get(addressKey(address))?.map(place => place.minutes)).toEqual([6, 0, 6]);
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.origins).toHaveLength(1);
    expect(body.destinations).toHaveLength(3);
    expect(body.travelMode).toBe('WALK');
    expect(fetchMock.mock.calls[0][1]?.cache).toBe('no-store');
  });

  it('preserves successful elements alongside missing, malformed and failed routes', async () => {
    fetchMock.mockResolvedValue(reply([ok, { ...ok, destinationIndex: 1, duration: 'invalid' }, { destinationIndex: 2, condition: 'ROUTE_NOT_FOUND' }]));
    const result = (await walkingMatrix([address], hubs)).get(addressKey(address))!;
    expect(result.map(place => place.status)).toEqual(['ok', 'unavailable', 'no_route']);
    expect(result.map(place => place.minutes)).toEqual([6, null, null]);
  });

  it('does not invent missing distances or turn element errors into successful routes', async () => {
    fetchMock.mockResolvedValue(reply([{ ...ok, distanceMeters: undefined }, { ...ok, destinationIndex: 1, status: { code: 3 } }, { ...ok, destinationIndex: 2, status: { code: 13 } }]));
    const result = (await walkingMatrix([address], hubs)).get(addressKey(address))!;
    expect(result[0].distanceMeters).toBeNull();
    expect(result.map(place => place.status)).toEqual(['ok', 'invalid_address', 'unavailable']);
  });

  it('bounds batches and total origins, leaving overflow visible', async () => {
    fetchMock.mockImplementation(async () => reply([]));
    const result = await walkingMatrix(Array.from({ length: 251 }, (_, i) => `${i + 1} Main St`), hubs);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    for (const [, options] of fetchMock.mock.calls) {
      const body = JSON.parse(options!.body as string);
      expect(body.origins.length + body.destinations.length).toBeLessThanOrEqual(50);
    }
    expect(result.get('251 main st')?.every(place => place.status === 'limited')).toBe(true);
  });

  it.each([401, 403, 429])('stops subsequent batches on HTTP %i', async status => {
    fetchMock.mockResolvedValue(reply({}, status));
    const result = await walkingMatrix(Array.from({ length: 41 }, (_, i) => `${i + 1} Main St`), hubs);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.get('41 main st')?.[0].status).toBe(status === 429 ? 'limited' : 'unavailable');
  });

  it('retries a transient server failure only once', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(reply({}, 503));
    const pending = walkingMatrix([address], hubs);
    await vi.runAllTimersAsync();
    expect((await pending).get(addressKey(address))?.[0].status).toBe('unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not call Google for missing configuration, invalid addresses or exhausted budget', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
    expect((await walkingMatrix([address], hubs)).get(addressKey(address))?.[0].status).toBe('not_configured');
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-only');
    expect((await walkingMatrix(['Unknown'], hubs)).get('unknown')?.[0].status).toBe('invalid_address');
    vi.mocked(reserveWalkingRequest).mockReturnValue(null);
    expect((await walkingMatrix([address], hubs)).get(addressKey(address))?.[0].status).toBe('limited');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts without retry when the caller leaves', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => { controller.abort(); throw new Error('aborted'); });
    await expect(walkingMatrix([address], hubs, controller.signal)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns partial evidence when the overall deadline expires', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => ms === 45_000 ? deadline.signal : new AbortController().signal);
    fetchMock.mockImplementation(async () => { deadline.abort(); throw new Error('timeout'); });
    expect((await walkingMatrix([address], hubs)).get(addressKey(address))?.[0].status).toBe('unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    timeout.mockRestore();
  });
});
