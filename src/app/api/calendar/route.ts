import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { calendarConfigured } from "@/lib/calendar/config";
import { currentStudent } from "@/lib/supabase/auth";
import { analyzeCalendarPlaces } from "@/lib/calendar/recurring";
import { classifyPlaces } from "@/lib/calendar/classify";
import { CalendarReadError, readCalendarMonth } from "@/lib/calendar/read";

export const maxDuration = 60;

export async function GET(request: Request) {
  const available = calendarConfigured();
  const store = await cookies();
  const token = store.get("housing_calendar_token")?.value;
  const owner = store.get("housing_calendar_owner")?.value;
  if (!available || !token || !owner || (await currentStudent())?.id !== owner) return NextResponse.json({ available, connected: false, places: [] });
  if (new URL(request.url).searchParams.get("review") !== "1") return NextResponse.json({ available, connected: true, places: [] });
  try {
    const { events, ...scan } = await readCalendarMonth(token);
    const analyzed = analyzeCalendarPlaces(events);
    const places = await classifyPlaces(analyzed.places);
    return NextResponse.json({ available, connected: true, places: places.sort((a, b) => b.count - a.count).slice(0, 5),
      scan: { ...scan, ...analyzed.diagnostics, missingLocation: analyzed.diagnostics.missingLocation
        + analyzed.places.reduce((sum, place) => sum + place.count, 0) - places.reduce((sum, place) => sum + place.count, 0) } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof CalendarReadError && [401, 403].includes(error.status)) {
      return NextResponse.json({ available, connected: false, needsReconnect: true, places: [],
        message: 'Reconnect Google Calendar and allow access to your calendar list and events so we can include course calendars.' });
    }
    return NextResponse.json({ error: 'Could not read your calendars. Please retry; your saved places have not changed.' }, { status: 502 });
  }
}
