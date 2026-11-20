import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('server-only', () => ({}));

const url = 'http://localhost/api/travel-times';
const addresses = {
  origin: '1107 S University Ave, Ann Arbor, MI',
  destination: '500 S State St, Ann Arbor, MI',
};

function request(body: unknown): Request {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('POST /api/travel-times', () => {
  it('rejects invalid addresses before calling Google', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ ...addresses, origin: 'x' }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a missing server key without calling Google', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request(addresses));

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns walking, driving, and bus routes without exposing the key', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'private-test-key');
    const fetchMock = vi.fn().mockImplementation(async (_url, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      const route = {
        duration: body.travelMode === 'DRIVE' ? '420s' : '960s',
        distanceMeters: body.travelMode === 'DRIVE' ? 1800 : 1100,
        ...(body.travelMode === 'TRANSIT' && {
          legs: [{ steps: [{}, { transitDetails: { transitLine: { vehicle: { type: 'BUS' } } } }] }],
        }),
      };

      return Response.json({ routes: [route] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request(addresses));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.routes).toEqual({
      walking: { durationMinutes: 16, distanceMeters: 1100 },
      driving: { durationMinutes: 7, distanceMeters: 1800 },
      bus: { durationMinutes: 16, distanceMeters: 1100 },
    });
    expect(result.attribution).toBe('Google Maps');
    expect(JSON.stringify(result)).not.toContain('private-test-key');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers['X-Goog-FieldMask']).toContain('transitDetails');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).transitPreferences).toEqual({ allowedTravelModes: ['BUS'] });
  });

  it('does not label a rail route as a bus route', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'private-test-key');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      return Response.json({ routes: [{
        duration: '600s',
        distanceMeters: 1000,
        ...(body.travelMode === 'TRANSIT' && {
          legs: [{ steps: [{ transitDetails: { transitLine: { vehicle: { type: 'TRAM' } } } }] }],
        }),
      }] });
    }));

    const response = await POST(request(addresses));
    const result = await response.json();

    expect(result.routes.bus).toBeNull();
    expect(result.routes.walking).not.toBeNull();
  });
});
