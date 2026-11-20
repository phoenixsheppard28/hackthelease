import { z } from "zod";
import { NextResponse } from "next/server";
import { housingProfileSchema } from "@/lib/contracts/housing-profile";
import { rankLiveListings } from "@/lib/matching/live-ranking";
import { weightsSchema } from "@/lib/contracts/matching-weights";

const schema = z.object({
  profile: housingProfileSchema,
  weights: weightsSchema,
  listingId: z.uuid().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your profile and priorities." }, { status: 400 });
  try {
    const { profile, weights, listingId } = parsed.data;
    const result = await rankLiveListings(profile, weights, listingId);
    if (listingId && !result.matches.length) return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not load listings from Supabase. Please try again." }, { status: 503 });
  }
}
