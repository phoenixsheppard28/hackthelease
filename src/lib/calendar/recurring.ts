export type CalendarInstance = {
  recurringEventId?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string };
};

export type FrequentPlace = { title: string; location: string; count: number };

export function frequentRecurringPlaces(events: CalendarInstance[]): FrequentPlace[] {
  const series = new Map<string, FrequentPlace>();
  for (const event of events) {
    const location = event.location?.trim();
    if (!event.recurringEventId || !location || !event.start?.dateTime) continue;

    const key = event.recurringEventId + "|" + location.toLowerCase().replace(/\s+/g, " ");
    const current = series.get(key);
    series.set(key, current ? { ...current, count: current.count + 1 } : { title: event.summary?.trim() || "Recurring event", location, count: 1 });
  }

  const places = new Map<string, FrequentPlace>();
  for (const place of series.values()) {
    if (place.count < 20) continue;

    const key = place.location.toLowerCase().replace(/\s+/g, " ");
    const current = places.get(key);
    places.set(key, current ? { ...current, count: current.count + place.count } : place);
  }

  return [...places.values()].sort((a, b) => b.count - a.count);
}
