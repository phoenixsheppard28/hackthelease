import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { currentStudent } from "@/lib/supabase/auth";

const cookieValues = new Map<string, string>();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ currentStudent: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined }) }));

beforeEach(() => {
  cookieValues.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("GOOGLE_CLIENT_ID", "legacy-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "legacy-secret");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.mocked(currentStudent).mockReset().mockResolvedValue({ id: "student-1", email: "student@example.com" });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function mockCalendarFetch(fetchEvents: (url: string, options: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => url.includes("/users/me/calendarList")
    ? Promise.resolve(Response.json({ items: [{ id: "primary" }] }))
    : fetchEvents(url, options)));
}

it('imports a building from event titles without asking for an address and skips location-free tasks', async () => {
  cookieValues.set('housing_calendar_token', 'google-token');
  cookieValues.set('housing_calendar_owner', 'student-1');
  const start = { dateTime: '2026-11-18T10:00:00Z' };
  mockCalendarFetch(vi.fn().mockResolvedValue(Response.json({ items: [
    { summary: 'Leinweber 2421', start }, { summary: 'Leinweber 1125', start },
    { summary: 'study', start }, { summary: 'coffee chat', start },
  ] })));
  const data = await (await GET(new Request('http://localhost/api/calendar?review=1'))).json();
  expect(data.places).toEqual([{ name: 'Leinweber Building', address: '2200 Hayward St, Ann Arbor, MI 48109', count: 2 }]);
  expect(data.scan.missingLocation).toBe(2);
});

it("does not fetch Calendar events for another student", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-2");
  const fetchEvents = vi.fn();
  mockCalendarFetch(fetchEvents);

  const response = await GET(new Request("http://localhost:8000/api/calendar"));

  expect((await response.json()).connected).toBe(false);
  expect(fetchEvents).not.toHaveBeenCalled();
});

it("fetches events for the student who connected Calendar", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const fetchEvents = vi.fn().mockResolvedValue(Response.json({ items: [{ location: "Leinweber 2421", start: { dateTime: "2026-11-21T10:00:00Z" } }] }));
  mockCalendarFetch(fetchEvents);

  const response = await GET(new Request("http://localhost:8000/api/calendar?review=1"));

  expect((await response.json()).places).toEqual([{ name: "Leinweber Building", address: "2200 Hayward St, Ann Arbor, MI 48109", count: 1 }]);
  expect(fetchEvents).toHaveBeenCalledWith(expect.stringContaining("googleapis.com/calendar"), expect.objectContaining({ headers: { Authorization: "Bearer google-token" } }));
});

it("pages through the past 30 days and expands recurring visits", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const instances = Array.from({ length: 20 }, (_, index) => ({ recurringEventId: "class", summary: "Class", location: "101 College Ave, Ann Arbor, MI", start: { dateTime: `2027-01-${String(index + 1).padStart(2, "0")}T10:00:00Z` } }));
  const fetchEvents = vi.fn()
    .mockResolvedValueOnce(Response.json({ items: instances.slice(0, 10), nextPageToken: "page-2" }))
    .mockResolvedValueOnce(Response.json({ items: instances.slice(10) }));
  mockCalendarFetch(fetchEvents);

  const response = await GET(new Request("http://localhost:8000/api/calendar?review=1"));
  const data = await response.json();

  expect(data.places).toEqual([{ name: "101 College Ave, Ann Arbor, MI", address: "101 College Ave, Ann Arbor, MI", count: 20 }]);
  expect(fetchEvents).toHaveBeenCalledTimes(2);
  expect(fetchEvents.mock.calls[1][0]).toContain("pageToken=page-2");
  const query = new URL(fetchEvents.mock.calls[0][0]).searchParams;
  expect(query.get("timeMin")).toBe("2026-10-21T12:00:00.000Z");
  expect(query.get("timeMax")).toBe("2026-11-20T12:00:00.000Z");
  expect(query.get("singleEvents")).toBe("true");
});

it("returns the five most visited places in descending order", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const items = Array.from({ length: 7 }, (_, index) => Array.from({ length: index + 1 }, () => ({
    location: `${100 + index} Main St, Ann Arbor, MI`, start: { dateTime: "2026-12-01T10:00:00Z" },
  }))).flat();
  mockCalendarFetch(vi.fn().mockResolvedValue(Response.json({ items })));
  const data = await (await GET(new Request("http://localhost:8000/api/calendar?review=1"))).json();
  expect(data.places.map((place: { count: number }) => place.count)).toEqual([7, 6, 5, 4, 3]);
});

it("continues past five Calendar pages before counting visits", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const instances = Array.from({ length: 20 }, (_, index) => ({ recurringEventId: "class", summary: "Class", location: "Leinweber 2421", start: { dateTime: `2027-01-${String(index + 1).padStart(2, "0")}T10:00:00Z` } }));
  const fetchEvents = vi.fn()
    .mockResolvedValueOnce(Response.json({ items: instances.slice(0, 10), nextPageToken: "2" }))
    .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: "3" }))
    .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: "4" }))
    .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: "5" }))
    .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: "6" }))
    .mockResolvedValueOnce(Response.json({ items: instances.slice(10) }));
  mockCalendarFetch(fetchEvents);

  const data = await (await GET(new Request("http://localhost:8000/api/calendar?review=1"))).json();

  expect(fetchEvents).toHaveBeenCalledTimes(6);
  expect(data.places[0].count).toBe(20);
});

it("shows connection status without reanalyzing saved Calendar places", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const fetchEvents = vi.fn();
  mockCalendarFetch(fetchEvents);

  const data = await (await GET(new Request("http://localhost:8000/api/calendar"))).json();

  expect(data).toEqual({ available: true, connected: true, places: [] });
  expect(fetchEvents).not.toHaveBeenCalled();
});


it("reads course calendars on later calendar-list pages, not just primary", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const fetchAll = vi.fn(async (url: string) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("calendarList")) return Response.json(parsed.searchParams.has("pageToken")
      ? { items: [{ id: "courses@example.com" }] }
      : { items: [{ id: "primary" }], nextPageToken: "more-calendars" });
    if (parsed.pathname.includes("courses%40example.com")) return Response.json({ items: [
      { iCalUID: "chem-1", summary: "CHEM 130", location: "Leinweber 2421", start: { dateTime: "2026-11-18T10:00:00Z" } },
      { iCalUID: "chem-2", summary: "CHEM 130", location: "Leinweber 2421", start: { dateTime: "2026-11-19T10:00:00Z" } },
    ] });
    return Response.json({ items: [{ summary: "No room yet", start: { dateTime: "2026-11-19T12:00:00Z" } }] });
  });
  vi.stubGlobal("fetch", fetchAll);
  const data = await (await GET(new Request("http://localhost/api/calendar?review=1"))).json();
  expect(data.places).toEqual([{ name: "Leinweber Building", address: "2200 Hayward St, Ann Arbor, MI 48109", count: 2 }]);
  expect(data.scan).toMatchObject({ calendarsRead: 2, calendarsFailed: 0, eventsRead: 3, missingLocation: 1 });
  expect(fetchAll).toHaveBeenCalledTimes(4);
});

it("asks older connections to reconnect when calendar-list access is missing", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
  const data = await (await GET(new Request("http://localhost/api/calendar?review=1"))).json();
  expect(data.needsReconnect).toBe(true);
  expect(data.message).toContain("calendar list");
});

it("reports failed scans as errors instead of pretending there are no places", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
  const response = await GET(new Request("http://localhost/api/calendar?review=1"));
  expect(response.status).toBe(502);
});

it("labels partial calendar scans as incomplete", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("calendarList")) return Response.json({ items: [{ id: "primary" }, { id: "course" }] });
    if (url.includes("/course/")) return new Response(null, { status: 503 });
    return Response.json({ items: [{ location: "Hatcher Library", start: { dateTime: "2026-11-19T10:00:00Z" } }] });
  }));
  const data = await (await GET(new Request("http://localhost/api/calendar?review=1"))).json();
  expect(data.places).toHaveLength(1);
  expect(data.scan).toMatchObject({ calendarsRead: 1, calendarsFailed: 1 });
});
