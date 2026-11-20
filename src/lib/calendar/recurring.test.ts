import { expect, it } from "vitest";
import { frequentCalendarPlaces } from "./recurring";

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
