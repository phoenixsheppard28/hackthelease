import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authClient, currentStudent } from "@/lib/supabase/auth";
import { callbackUrl } from "@/lib/calendar/config";

export async function GET(request: Request) {
  const expectedId = (await cookies()).get("housing_calendar_user")?.value;
  const student = await currentStudent();
  const code = new URL(request.url).searchParams.get("code");
  let status = "calendar-error";
  let token = "";

  if (expectedId && student?.id === expectedId && code) {
    try {
      const client = await authClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data.user?.id !== expectedId) {
        status = "calendar-account-error";
        await client.auth.signOut({ scope: "local" });
      } else if (!error && data.session?.provider_token) {
        token = data.session.provider_token;
        status = "calendar-connected";
      }
    } catch {}
  }

  const response = new NextResponse(
    '<!doctype html><title>Google Calendar</title><p>You can return to your housing search.</p><script>if(window.opener){window.opener.postMessage("' + status + '",window.location.origin);window.close();}else if("' + status + '"==="calendar-connected"){window.location.replace("/?calendar=review");}</script>',
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
  response.cookies.delete({ name: "housing_calendar_user", path: "/api/calendar" });
  response.cookies.delete({ name: "housing_calendar_state", path: "/api/calendar" });

  if (token) {
    // shortcut: Calendar access expires after one hour; refresh tokens are needed for persistent sync.
    const options = { httpOnly: true, sameSite: "lax" as const, secure: callbackUrl(request.url).startsWith("https:"), maxAge: 3600, path: "/api/calendar" };
    response.cookies.set("housing_calendar_token", token, options);
    response.cookies.set("housing_calendar_owner", expectedId!, options);
  } else {
    response.cookies.delete({ name: "housing_calendar_token", path: "/api/calendar" });
    response.cookies.delete({ name: "housing_calendar_owner", path: "/api/calendar" });
  }

  return response;
}
