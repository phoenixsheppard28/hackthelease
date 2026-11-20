import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { authClient, currentStudent } from "@/lib/supabase/auth";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ authClient: vi.fn(), currentStudent: vi.fn() }));

const signInWithOAuth = vi.fn();

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.mocked(currentStudent).mockReset().mockResolvedValue({ id: "student-1", email: "student@example.com" });
  signInWithOAuth.mockReset().mockResolvedValue({ data: { url: "https://project.supabase.co/auth/v1/authorize" }, error: null });
  vi.mocked(authClient).mockResolvedValue({ auth: { signInWithOAuth } } as never);
});

afterEach(() => vi.unstubAllEnvs());

it("requests Calendar access through Supabase Google OAuth", async () => {
  const response = await GET(new Request("http://localhost:8000/api/calendar/connect"));

  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: {
    redirectTo: "http://localhost:8000/api/calendar/callback",
    scopes: "https://www.googleapis.com/auth/calendar.events.readonly",
    queryParams: { prompt: "consent", login_hint: "student@example.com" },
  } });
  expect(response.headers.get("location")).toBe("https://project.supabase.co/auth/v1/authorize");
  expect(response.cookies.get("housing_calendar_user")?.value).toBe("student-1");
});

it("requires a signed-in student", async () => {
  vi.mocked(currentStudent).mockResolvedValue(null);

  const response = await GET(new Request("http://localhost:8000/api/calendar/connect"));

  expect(response.status).toBe(401);
  expect(signInWithOAuth).not.toHaveBeenCalled();
});

it("uses the production Calendar callback on Vercel", async () => {
  vi.stubEnv("VERCEL_ENV", "production");

  await GET(new Request("http://localhost:3000/api/calendar/connect"));

  expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ redirectTo: "https://tryhomework.vercel.app/api/calendar/callback" }) }));
});
