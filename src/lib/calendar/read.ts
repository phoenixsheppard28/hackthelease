import type { CalendarInstance } from './recurring';

export class CalendarReadError extends Error {
  constructor(public status: number) { super('Could not read Google Calendar'); }
}

// Include subscribed course calendars as well as the account's primary calendar.
export async function readCalendarMonth(token: string, now = new Date()) {
  const deadline = AbortSignal.timeout(40000);
  async function getPage<T>(path: string, query: URLSearchParams): Promise<T> {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}?${query}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      signal: AbortSignal.any([deadline, AbortSignal.timeout(10000)]),
    });
    if (!response.ok) throw new CalendarReadError(response.status);
    return response.json();
  }

  const calendarIds = new Set<string>();
  const calendarsQuery = new URLSearchParams({ minAccessRole: 'reader', showHidden: 'true', maxResults: '250', fields: 'nextPageToken,items(id)' });
  while (true) {
    const page = await getPage<{ items?: { id: string }[]; nextPageToken?: string }>('users/me/calendarList', calendarsQuery);
    for (const calendar of page.items ?? []) calendarIds.add(calendar.id);
    if (!page.nextPageToken) break;
    calendarsQuery.set('pageToken', page.nextPageToken);
  }

  const timeMax = now.toISOString();
  const timeMin = new Date(now.getTime() - 30 * 86400000).toISOString();
  const events: CalendarInstance[] = [];
  const ids = [...calendarIds];
  let next = 0;
  let calendarsRead = 0;
  let calendarsFailed = 0;
  // Bound concurrency while still allowing large calendar lists to finish.
  await Promise.all(Array.from({ length: Math.min(3, ids.length) }, async () => {
    while (next < ids.length) {
      const id = ids[next++];
      const query = new URLSearchParams({ timeMin, timeMax, maxResults: '2500', singleEvents: 'true', orderBy: 'startTime', showDeleted: 'false',
        fields: 'nextPageToken,items(iCalUID,recurringEventId,summary,location,start,originalStartTime,status,attendees(self,responseStatus))' });
      const collected: CalendarInstance[] = [];
      try {
        while (true) {
          const page = await getPage<{ items?: CalendarInstance[]; nextPageToken?: string }>(`calendars/${encodeURIComponent(id)}/events`, query);
          collected.push(...(page.items ?? []));
          if (!page.nextPageToken) break;
          query.set('pageToken', page.nextPageToken);
        }
        events.push(...collected);
        calendarsRead++;
      } catch (error) {
        if (error instanceof CalendarReadError && error.status === 401) throw error;
        calendarsFailed++;
      }
    }
  }));
  if (ids.length && !calendarsRead) throw new CalendarReadError(502);
  return { events, calendarsRead, calendarsFailed, timeMin, timeMax };
}
