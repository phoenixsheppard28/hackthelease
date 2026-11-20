import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { calendarConfigured } from "@/lib/calendar/config";
import { currentStudent } from "@/lib/supabase/auth";
import { frequentRecurringPlaces, type CalendarInstance } from "@/lib/calendar/recurring";
import { classifyPlaces } from "@/lib/calendar/classify";

export const maxDuration = 60;

export async function GET(request: Request) {
  const available = calendarConfigured();
  const store = await cookies();
  const token = store.get("housing_calendar_token")?.value;
  const owner = store.get("housing_calendar_owner")?.value;
  if (!available || !token || !owner || (await currentStudent())?.id !== owner) return NextResponse.json({ available, connected: false, places: [] });
  if (new URL(request.url).searchParams.get("review") !== "1") return NextResponse.json({ available, connected: true, places: [] });
  const now = new Date();
  const deadline = AbortSignal.timeout(40000);
  const query = new URLSearchParams({
    timeMin: now.toISOString(), timeMax: new Date(now.getTime() + 120 * 86400000).toISOString(),
    maxResults: "2500", singleEvents: "true", orderBy: "startTime",
    fields: "nextPageToken,items(recurringEventId,summary,location,start)",
  });
  try {
    const events: CalendarInstance[] = [];
    while (true) {
      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?" + query, {
        headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: AbortSignal.any([deadline, AbortSignal.timeout(10000)]),
      });
      if (!response.ok) throw new Error();

      const data: { items?: CalendarInstance[]; nextPageToken?: string } = await response.json();
      events.push(...(data.items || []));
      if (!data.nextPageToken) return NextResponse.json({ available, connected: true, places: await classifyPlaces(frequentRecurringPlaces(events)) });
      query.set("pageToken", data.nextPageToken);
    }
  } catch {
    return NextResponse.json({ available, connected: false, places: [] });
  }
}
