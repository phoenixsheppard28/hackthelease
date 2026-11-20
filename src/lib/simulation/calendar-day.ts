import type { CalendarInstance } from '@/lib/calendar/recurring';

export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type Weekday = typeof weekdays[number];

export function representativeCalendarDay(events: CalendarInstance[], weekday: Weekday) {
  const days = new Map<string, { title: string; location: string; time: string }[]>();
  const seen = new Set<string>();
  for (const event of events) {
    const start = event.start?.dateTime;
    if (!start || event.status === 'cancelled' || event.attendees?.some(attendee => attendee.self && attendee.responseStatus === 'declined')) continue;
    if (/\b(online|remote|virtual|zoom)\b|meet\.google\.com|teams\.microsoft\.com/i.test(`${event.location ?? ''} ${event.summary ?? ''}`)) continue;

    const date = new Date(start);
    if (Number.isNaN(date.getTime())) continue;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
    if (part('weekday') !== weekday) continue;
    const day = `${part('year')}-${part('month')}-${part('day')}`;
    const key = `${event.iCalUID ?? event.summary ?? ''}:${start}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const items = days.get(day) ?? [];
    items.push({ title: (event.summary || 'Calendar event').slice(0, 100), location: (event.location || 'Location not specified').slice(0, 120),
      time: new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', hour: 'numeric', minute: '2-digit' }).format(date) });
    days.set(day, items);
  }

  const selected = [...days].sort((a, b) => b[1].length - a[1].length || b[0].localeCompare(a[0]))[0];
  return selected ? { date: selected[0], events: selected[1].slice(0, 12) } : null;
}
