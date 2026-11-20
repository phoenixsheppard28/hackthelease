import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { callbackUrl } from "@/lib/calendar/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const expected = (await cookies()).get("housing_calendar_state")?.value || "";
  let token = "";
  let lifetime = 0;
  if (expected && state.length === expected.length && timingSafeEqual(Buffer.from(state), Buffer.from(expected)) && url.searchParams.get("code")) {
    try {
      const result = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code: url.searchParams.get("code")!, grant_type: "authorization_code", redirect_uri: callbackUrl(request.url),
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (result.ok) {
        const data = await result.json();
        token = data.access_token || "";
        lifetime = Math.min(Number(data.expires_in) || 0, 3600);
      }
    } catch { /* The popup returns an error to the survey so it can offer a retry. */ }
  }
  const status = token ? "calendar-connected" : "calendar-error";
  const response = new NextResponse(
    '<!doctype html><title>Google Calendar</title><p>You can return to your housing search.</p><script>if(window.opener){window.opener.postMessage("' + status + '",window.location.origin);window.close();}</script>',
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
  response.cookies.delete({ name: "housing_calendar_state", path: "/api/calendar" });
  if (token) response.cookies.set("housing_calendar_token", token, { httpOnly: true, sameSite: "lax", secure: callbackUrl(request.url).startsWith("https:"), maxAge: lifetime, path: "/api/calendar" });
  return response;
}
