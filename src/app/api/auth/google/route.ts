import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const origin = new URL(process.env.APP_BASE_URL || request.url).origin;

  try {
    const { data, error } = await (await authClient()).auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/api/auth/callback` },
    });
    if (!error && data.url) return NextResponse.redirect(data.url);
  } catch {}

  return NextResponse.redirect(`${origin}/?authError=google`);
}
