import { z } from 'zod';
import { estimateTravel } from '../../../lib/travel/estimate';
import { requireStudent } from '@/lib/supabase/require-student';

const TravelRequestSchema = z.object({
  origin: z.string().trim().min(5).max(200),
  destination: z.string().trim().min(5).max(200),
  departureTime: z.iso.datetime({ offset: true }).optional(),
  mode: z.enum(['all', 'bus']).default('all'),
});

export async function POST(request: Request) {
  const denied = await requireStudent();
  if (denied) return denied;
  const body = TravelRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: 'Enter valid origin and destination addresses.' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Travel estimates are not configured.' }, { status: 503 });
  }

  try {
    const routes = await estimateTravel(body.data.origin, body.data.destination, apiKey, body.data.departureTime, body.data.mode);

    return Response.json({
      origin: body.data.origin,
      destination: body.data.destination,
      departureTime: body.data.departureTime ?? null,
      routes,
      attribution: 'Google Maps',
      walkingWarning: 'Walking routes may not include all sidewalks or pedestrian paths.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Travel estimate failed:', error);
    return Response.json({ error: 'Travel estimates are unavailable.' }, { status: 502 });
  }
}
