import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { currentStudent } from "@/lib/supabase/auth";

const cookieValues = new Map<string, string>();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ currentStudent: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined }) }));

beforeEach(() => {
  cookieValues.clear();
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("GOOGLE_CLIENT_ID", "legacy-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "legacy-secret");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.mocked(currentStudent).mockReset().mockResolvedValue({ id: "student-1", email: "student@example.com" });
});

it("does not fetch Calendar events for another student", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-2");
  const fetchEvents = vi.fn();
  vi.stubGlobal("fetch", fetchEvents);

  const response = await GET(new Request("http://localhost:8000/api/calendar"));

  expect((await response.json()).connected).toBe(false);
  expect(fetchEvents).not.toHaveBeenCalled();
});

it("fetches events for the student who connected Calendar", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const fetchEvents = vi.fn().mockResolvedValue(Response.json({ items: [{ location: "Campus", start: { dateTime: "2026-11-21T10:00:00Z" } }] }));
  vi.stubGlobal("fetch", fetchEvents);

  const response = await GET(new Request("http://localhost:8000/api/calendar?review=1"));

  expect((await response.json()).places).toEqual([{ name: "Campus", address: "", count: 1 }]);
  expect(fetchEvents).toHaveBeenCalledWith(expect.stringContaining("googleapis.com/calendar"), expect.objectContaining({ headers: { Authorization: "Bearer google-token" } }));
});

it("pages through 120 days and counts visits to each place", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const instances = Array.from({ length: 20 }, (_, index) => ({ recurringEventId: "class", summary: "Class", location: "101 College Ave, Ann Arbor, MI", start: { dateTime: `2027-01-${String(index + 1).padStart(2, "0")}T10:00:00Z` } }));
  const fetchEvents = vi.fn()
    .mockResolvedValueOnce(Response.json({ items: instances.slice(0, 10), nextPageToken: "page-2" }))
    .mockResolvedValueOnce(Response.json({ items: instances.slice(10) }));
  vi.stubGlobal("fetch", fetchEvents);

  const response = await GET(new Request("http://localhost:8000/api/calendar?review=1"));
  const data = await response.json();

  expect(data.places).toEqual([{ name: "101 College Ave, Ann Arbor, MI", address: "", count: 20 }]);
  expect(fetchEvents).toHaveBeenCalledTimes(2);
  expect(fetchEvents.mock.calls[1][0]).toContain("pageToken=page-2");
  expect(fetchEvents.mock.calls[0][0]).toContain("timeMax=");
});

it("returns the five most visited places in descending order", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const items = Array.from({ length: 7 }, (_, index) => Array.from({ length: index + 1 }, () => ({
    location: `Campus place ${index}`, start: { dateTime: "2026-12-01T10:00:00Z" },
  }))).flat();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ items })));
  const data = await (await GET(new Request("http://localhost:8000/api/calendar?review=1"))).json();
  expect(data.places.map((place: { count: number }) => place.count)).toEqual([7, 6, 5, 4, 3]);
});

it("continues past five Calendar pages before counting visits", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const instances = Array.from({ length: 20 }, (_, index) => ({ recurringEventId: "class", summary: "Class", location: "Chem Building", start: { dateTime: `2027-01-${String(index + 1).padStart(2, "0")}T10:00:00Z` } }));
  const fetchEvents = vi.fn()
    .mockResolvedValueOnce(Response.json({ items: instances.slice(0, 10), nextPageToken: "2" }))
    .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: "3" }))
    .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: "4" }))
    .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: "5" }))
    .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: "6" }))
    .mockResolvedValueOnce(Response.json({ items: instances.slice(10) }));
  vi.stubGlobal("fetch", fetchEvents);

  const data = await (await GET(new Request("http://localhost:8000/api/calendar?review=1"))).json();

  expect(fetchEvents).toHaveBeenCalledTimes(6);
  expect(data.places[0].count).toBe(20);
});

it("shows connection status without reanalyzing saved Calendar places", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const fetchEvents = vi.fn();
  vi.stubGlobal("fetch", fetchEvents);

  const data = await (await GET(new Request("http://localhost:8000/api/calendar"))).json();

  expect(data).toEqual({ available: true, connected: true, places: [] });
  expect(fetchEvents).not.toHaveBeenCalled();
});
