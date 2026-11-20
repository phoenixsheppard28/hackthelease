import { z } from 'zod';
import { HousingProfileSchema } from '@/lib/contracts/housing';
import { rankProfile } from '@/lib/matching/rank-profile';

const RankRequestSchema = HousingProfileSchema.extend({
  lifestyleText: HousingProfileSchema.shape.lifestyleText.max(2000),
  preferredAmenities: z.array(z.string().max(64)).max(20),
});

export async function POST(request: Request) {
  const profile = RankRequestSchema.safeParse(await request.json().catch(() => null));
  if (!profile.success) {
    return Response.json({ error: 'Invalid housing profile.' }, { status: 400 });
  }

  return Response.json(await rankProfile(profile.data));
}
