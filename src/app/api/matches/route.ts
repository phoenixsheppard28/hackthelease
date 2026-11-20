import { z } from "zod";
import { NextResponse } from "next/server";
import { housingProfileSchema } from "@/lib/contracts/housing-profile";
import { rankLiveListings } from "@/lib/matching/live-ranking";
import { weightsSchema } from "@/lib/contracts/matching-weights";
import { requireStudent } from '@/lib/supabase/require-student';

const schema = z.object({
  profile: housingProfileSchema,
  weights: weightsSchema,
  listingId: z.uuid().optional(),
});
export const maxDuration = 120;
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const denied = await requireStudent();
  if (denied) return denied;
  const text = await request.text();
  if (text.length > 65536) return NextResponse.json({ error: 'Profile is too large.' }, { status: 413, headers });
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = null; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check your profile and priorities." }, { status: 400, headers });
  try {
    const { profile, weights, listingId } = parsed.data;
    const result = await rankLiveListings(profile, weights, listingId, request.signal);
    if (listingId && !result.matches.length) return NextResponse.json({ error: "This listing is no longer available." }, { status: 404, headers });
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({ error: "Could not load listings. Please try again." }, { status: request.signal.aborted ? 499 : 503, headers });
  }
}
