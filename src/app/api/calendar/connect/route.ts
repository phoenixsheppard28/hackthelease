import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { calendarConfigured, callbackUrl } from "@/lib/calendar/config";

export async function GET(request: Request) {
  if (!calendarConfigured()) return NextResponse.json({ error: "Calendar is not configured." }, { status: 503 });
  const state = randomBytes(32).toString("hex");
  const redirect = callbackUrl(request.url);
  const query = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirect, response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events.readonly", state,
  });
  const response = NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + query);
  response.cookies.set("housing_calendar_state", state, { httpOnly: true, sameSite: "lax", secure: redirect.startsWith("https:"), maxAge: 600, path: "/api/calendar" });
  return response;
}
