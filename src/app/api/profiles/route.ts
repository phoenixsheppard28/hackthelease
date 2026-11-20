import { NextResponse } from "next/server";
import { savedProfileSchema } from "@/lib/contracts/housing-profile";
import { profilesRequest } from "@/lib/supabase/profiles";
import { currentStudent } from "@/lib/supabase/auth";

export async function GET() {
  const student = await currentStudent();
  if (!student) return NextResponse.json({ error: "Sign in to view profiles." }, { status: 401 });

  try {
    return NextResponse.json(await profilesRequest(student.id));
  } catch {
    return NextResponse.json({ error: "Saved profiles are unavailable. Please try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const student = await currentStudent();
  if (!student) return NextResponse.json({ error: "Sign in to save a profile." }, { status: 401 });

  try {
    const text = await request.text();
    if (text.length > 65536) return NextResponse.json({ error: "Profile is too large." }, { status: 413 });
    const result = savedProfileSchema.safeParse(JSON.parse(text));
    if (!result.success) return NextResponse.json({ error: "Check your profile answers." }, { status: 400 });
    await profilesRequest(student.id, result.data);
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: "Could not save your profile. Your answers are still here. Please retry." }, { status: 503 });
  }
}
