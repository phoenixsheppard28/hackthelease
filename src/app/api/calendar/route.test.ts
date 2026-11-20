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
  vi.mocked(currentStudent).mockReset().mockResolvedValue({ id: "student-1", email: "student@example.com" });
});

it("does not fetch Calendar events for another student", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-2");
  const fetchEvents = vi.fn();
  vi.stubGlobal("fetch", fetchEvents);

  const response = await GET();

  expect((await response.json()).connected).toBe(false);
  expect(fetchEvents).not.toHaveBeenCalled();
});

it("fetches events for the student who connected Calendar", async () => {
  cookieValues.set("housing_calendar_token", "google-token");
  cookieValues.set("housing_calendar_owner", "student-1");
  const fetchEvents = vi.fn().mockResolvedValue(Response.json({ items: [{ location: "Campus", start: { dateTime: "2026-11-21T10:00:00Z" } }] }));
  vi.stubGlobal("fetch", fetchEvents);

  const response = await GET();

  expect((await response.json()).events).toEqual([{ location: "Campus", time: "2026-11-21T10:00:00Z" }]);
  expect(fetchEvents).toHaveBeenCalledWith(expect.stringContaining("googleapis.com/calendar"), expect.objectContaining({ headers: { Authorization: "Bearer google-token" } }));
});
