import { NextResponse } from "next/server";
import { savedProfileSchema } from "@/lib/contracts/housing-profile";
import { profilesRequest } from "@/lib/supabase/profiles";

export async function GET() {
  try {
    return NextResponse.json(await profilesRequest());
  } catch {
    return NextResponse.json({ error: "Saved profiles are unavailable. Please try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 65536) return NextResponse.json({ error: "Profile is too large." }, { status: 413 });
    const result = savedProfileSchema.safeParse(JSON.parse(text));
    if (!result.success) return NextResponse.json({ error: "Check your profile answers." }, { status: 400 });
    await profilesRequest(result.data);
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: "Could not save your profile. Your answers are still here. Please retry." }, { status: 503 });
  }
}
