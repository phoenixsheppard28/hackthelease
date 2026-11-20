import { NextResponse } from "next/server";
import { authClient, currentStudent } from "@/lib/supabase/auth";
import { calendarConfigured, callbackUrl } from "@/lib/calendar/config";

export async function GET(request: Request) {
  if (!calendarConfigured()) return NextResponse.json({ error: "Calendar is not configured." }, { status: 503 });
  const student = await currentStudent();
  if (!student) return NextResponse.json({ error: "Sign in to connect your calendar." }, { status: 401 });

  const redirect = callbackUrl(request.url);
  try {
    const { data, error } = await (await authClient()).auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirect,
        scopes: "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly",
        queryParams: { prompt: "consent", login_hint: student.email },
      },
    });
    if (error || !data.url) throw error || new Error("Missing Google authorization URL.");

    const response = NextResponse.redirect(data.url);
    response.cookies.set("housing_calendar_user", student.id, { httpOnly: true, sameSite: "lax", secure: redirect.startsWith("https:"), maxAge: 600, path: "/api/calendar" });
    return response;
  } catch {
    return NextResponse.redirect(redirect + "?error=connection");
  }
}
