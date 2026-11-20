import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { authClient, currentStudent } from "@/lib/supabase/auth";
import { runInNewContext } from 'node:vm';

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ authClient: vi.fn(), currentStudent: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => name === "housing_calendar_user" ? { value: "student-1" } : undefined }) }));

const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();

beforeEach(() => {
  vi.mocked(currentStudent).mockReset().mockResolvedValue({ id: "student-1", email: "student@example.com" });
  exchangeCodeForSession.mockReset().mockResolvedValue({ data: { user: { id: "student-1" }, session: { provider_token: "google-token" } }, error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  vi.mocked(authClient).mockResolvedValue({ auth: { exchangeCodeForSession, signOut } } as never);
});

it("stores the Google token for the same student", async () => {
  const response = await GET(new Request("http://localhost:8000/api/calendar/callback?code=abc"));
  const html = await response.text();

  expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  expect(response.cookies.get("housing_calendar_token")?.value).toBe("google-token");
  expect(response.cookies.get("housing_calendar_owner")?.value).toBe("student-1");
  expect(html).toContain("calendar-connected");
  expect(html).toContain('window.location.replace("/?calendar=review")');
  const opener = { postMessage: vi.fn() };
  const close = vi.fn();
  const replace = vi.fn();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  runInNewContext(script, { window: { opener, close, location: { origin: 'http://localhost:8000', replace } } });
  expect(opener.postMessage).toHaveBeenCalledWith('calendar-connected', 'http://localhost:8000');
  expect(close).toHaveBeenCalledOnce();
  expect(replace).not.toHaveBeenCalled();
});

it("rejects a different Google account and clears its session", async () => {
  exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "student-2" }, session: { provider_token: "other-token" } }, error: null });

  const response = await GET(new Request("http://localhost:8000/api/calendar/callback?code=abc"));

  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(response.cookies.get("housing_calendar_token")?.value).toBe("");
  expect(await response.text()).toContain("calendar-account-error");
});

it("does not exchange a code without the signed-in student", async () => {
  vi.mocked(currentStudent).mockResolvedValue(null);

  const response = await GET(new Request("http://localhost:8000/api/calendar/callback?code=abc"));

  expect(exchangeCodeForSession).not.toHaveBeenCalled();
  expect(await response.text()).toContain("calendar-error");
});
