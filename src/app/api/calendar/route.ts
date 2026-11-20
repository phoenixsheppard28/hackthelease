import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { calendarConfigured } from "@/lib/calendar/config";

export async function GET() {
  const available = calendarConfigured();
  const token = (await cookies()).get("housing_calendar_token")?.value;
  if (!available || !token) return NextResponse.json({ available, connected: false, events: [] });
  const query = new URLSearchParams({
    timeMin: new Date().toISOString(), maxResults: "30", singleEvents: "true", orderBy: "startTime", fields: "items(location,start)",
  });
  try {
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?" + query, {
      headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
    const data: { items?: { location?: string; start?: { dateTime?: string } }[] } = await response.json();
    const events = (data.items || []).filter(event => event.location && event.start?.dateTime)
      .map(event => ({ location: event.location!, time: event.start!.dateTime! }));
    return NextResponse.json({ available, connected: true, events });
  } catch {
    return NextResponse.json({ available, connected: false, events: [] });
  }
}
