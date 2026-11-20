import 'server-only';
import { z } from 'zod';

const GoogleRouteSchema = z.object({
  routes: z.array(z.object({
    duration: z.string().regex(/^\d+(?:\.\d+)?s$/),
    distanceMeters: z.number().int().nonnegative(),
    legs: z.array(z.object({
      steps: z.array(z.object({
        transitDetails: z.object({
          transitLine: z.object({ vehicle: z.object({ type: z.string() }) }),
        }).optional(),
      })),
    })).optional(),
  })).optional(),
});

export type TravelRoute = { durationMinutes: number; distanceMeters: number } | null;
export type TravelEstimates = {
  walking: TravelRoute;
  driving: TravelRoute;
  bus: TravelRoute;
};

const busTypes = new Set(['BUS', 'INTERCITY_BUS', 'TROLLEYBUS']);

async function computeRoute(
  origin: string,
  destination: string,
  mode: 'WALK' | 'DRIVE' | 'TRANSIT',
  apiKey: string,
  departureTime?: string,
): Promise<TravelRoute> {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': mode === 'TRANSIT'
        ? 'routes.duration,routes.distanceMeters,routes.legs.steps.transitDetails.transitLine.vehicle.type'
        : 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode: mode,
      ...(departureTime && { departureTime }),
      ...(mode === 'DRIVE' && { routingPreference: 'TRAFFIC_AWARE' }),
      ...(mode === 'TRANSIT' && { transitPreferences: { allowedTravelModes: ['BUS'] } }),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Google Routes returned ${response.status}.`);
  }

  const parsed = GoogleRouteSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Google Routes returned an invalid route.');
  }

  const route = parsed.data.routes?.[0];
  if (!route) {
    return null;
  }

  if (mode === 'TRANSIT') {
    const vehicleTypes = route.legs?.flatMap((leg) => leg.steps.flatMap((step) =>
      step.transitDetails ? [step.transitDetails.transitLine.vehicle.type] : [],
    )) ?? [];
    if (vehicleTypes.length === 0 || vehicleTypes.some((type) => !busTypes.has(type))) {
      return null;
    }
  }

  return {
    durationMinutes: Math.ceil(Number.parseFloat(route.duration) / 60),
    distanceMeters: route.distanceMeters,
  };
}

export async function estimateTravel(
  origin: string,
  destination: string,
  apiKey: string,
  departureTime?: string,
): Promise<TravelEstimates> {
  const [walking, driving, bus] = await Promise.all([
    computeRoute(origin, destination, 'WALK', apiKey, departureTime),
    computeRoute(origin, destination, 'DRIVE', apiKey, departureTime),
    computeRoute(origin, destination, 'TRANSIT', apiKey, departureTime),
  ]);

  return { walking, driving, bus };
}
