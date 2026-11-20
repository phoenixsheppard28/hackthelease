export type CalendarInstance = {
  iCalUID?: string;
  status?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
  recurringEventId?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  originalStartTime?: { dateTime?: string; date?: string };
};

export type FrequentPlace = { title: string; location: string; count: number };

export function frequentCalendarPlaces(events: CalendarInstance[]): FrequentPlace[] {
  return analyzeCalendarPlaces(events).places;
}

export function analyzeCalendarPlaces(events: CalendarInstance[]) {
  const unique = new Map<string, CalendarInstance>();
  events.forEach((event, index) => {
    const start = event.originalStartTime?.dateTime ?? event.start?.dateTime ?? event.start?.date;
    const key = event.iCalUID && start ? `${event.iCalUID}:${Number.isNaN(Date.parse(start)) ? start : Date.parse(start)}` : `unidentified:${index}`;
    const previous = unique.get(key);
    if (!previous || (!previous.location?.trim() && event.location?.trim())) unique.set(key, event);
  });
  const diagnostics = { eventsRead: unique.size, missingLocation: 0, allDay: 0, online: 0, excluded: 0 };
  const places = new Map<string, FrequentPlace>();
  for (const event of unique.values()) {
    if (event.status === 'cancelled' || event.attendees?.some(attendee => attendee.self && attendee.responseStatus === 'declined')) { diagnostics.excluded++; continue; }
    if (!event.start?.dateTime) { diagnostics.allDay++; continue; }
    const location = event.location?.trim();
    if (!location) { diagnostics.missingLocation++; continue; }
    if (/\b(online|remote|virtual|zoom)\b|meet\.google\.com|teams\.microsoft\.com/i.test(location)) { diagnostics.online++; continue; }

    const key = location.toLowerCase().replace(/\s+/g, " ");
    const current = places.get(key);
    places.set(key, current ? { ...current, count: current.count + 1 } : { title: event.summary?.trim() || "Calendar event", location, count: 1 });
  }

  return { places: [...places.values()].sort((a, b) => b.count - a.count), diagnostics };
}
