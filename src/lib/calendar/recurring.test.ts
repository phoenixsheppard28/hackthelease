import { expect, it } from "vitest";
import { analyzeCalendarPlaces, frequentCalendarPlaces } from "./recurring";

it("counts timed visits across series and one-off events without a 20-visit cutoff", () => {
  const events = [
    ...Array.from({ length: 20 }, (_, index) => ({ recurringEventId: "class", summary: "Chemistry", location: "Chem Building", start: { dateTime: `2027-01-${String(index + 1).padStart(2, "0")}T10:00:00Z` } })),
    ...Array.from({ length: 19 }, (_, index) => ({ recurringEventId: "lab", summary: "Lab", location: "Lab Hall", start: { dateTime: `2027-01-${String(index + 1).padStart(2, "0")}T12:00:00Z` } })),
    { summary: "One-off", location: "Chem Building", start: { dateTime: "2027-01-21T10:00:00Z" } },
    { recurringEventId: "class", summary: "Chemistry", location: "Online", start: { dateTime: "2027-01-21T10:00:00Z" } },
  ];

  expect(frequentCalendarPlaces(events)).toEqual([
    { title: "Chemistry", location: "Chem Building", count: 21 },
    { title: "Lab", location: "Lab Hall", count: 19 },
  ]);
});

it('deduplicates copied class instances without collapsing the recurring series', () => {
  const first = { iCalUID: 'class', summary: 'CHEM', location: 'Chemistry', start: { dateTime: '2026-11-17T10:00:00Z' } };
  const second = { ...first, start: { dateTime: '2026-11-19T10:00:00Z' } };
  expect(frequentCalendarPlaces([first, { ...first, start: { dateTime: '2026-11-17T05:00:00-05:00' } }, second])).toEqual([{ title: 'CHEM', location: 'Chemistry', count: 2 }]);
});

it('reports skipped events and keeps the location from a richer event copy', () => {
  const timed = { start: { dateTime: '2026-11-17T10:00:00Z' } };
  const result = analyzeCalendarPlaces([
    { ...timed, iCalUID: 'class' },
    { ...timed, iCalUID: 'class', location: 'Chemistry' },
    { ...timed },
    { start: { date: '2026-11-17' }, location: 'Birthday' },
    { ...timed, location: 'Zoom' },
    { ...timed, location: 'Library', status: 'cancelled' },
    { ...timed, location: 'Union', attendees: [{ self: true, responseStatus: 'declined' }] },
  ]);
  expect(result.places).toEqual([{ title: 'Calendar event', location: 'Chemistry', count: 1 }]);
  expect(result.diagnostics).toEqual({ eventsRead: 6, missingLocation: 1, allDay: 1, online: 1, excluded: 2 });
});
