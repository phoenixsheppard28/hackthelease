import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.VERCEL_ENV === "production" ? "https://tryhomework.vercel.app" : url.origin;
  const code = url.searchParams.get("code");

  if (code) {
    try {
      const { error } = await (await authClient()).auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/", origin));
    } catch {}
  }

  return NextResponse.redirect(new URL("/?authError=google", origin));
}
