export type CalendarInstance = {
  recurringEventId?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string };
};

export type FrequentPlace = { title: string; location: string; count: number };

export function frequentCalendarPlaces(events: CalendarInstance[]): FrequentPlace[] {
  const places = new Map<string, FrequentPlace>();
  for (const event of events) {
    const location = event.location?.trim();
    if (!location || !event.start?.dateTime) continue;
    if (/\b(online|remote|virtual|zoom)\b|meet\.google\.com|teams\.microsoft\.com/i.test(location)) continue;

    const key = location.toLowerCase().replace(/\s+/g, " ");
    const current = places.get(key);
    places.set(key, current ? { ...current, count: current.count + 1 } : { title: event.summary?.trim() || "Calendar event", location, count: 1 });
  }

  return [...places.values()].sort((a, b) => b.count - a.count);
}
