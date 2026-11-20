import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { authClient } from "@/lib/supabase/auth";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ authClient: vi.fn() }));

const signInWithOAuth = vi.fn();

beforeEach(() => {
  signInWithOAuth.mockReset().mockResolvedValue({ data: { url: "https://accounts.google.com/start" }, error: null });
  vi.mocked(authClient).mockResolvedValue({ auth: { signInWithOAuth } } as never);
});

afterEach(() => vi.unstubAllEnvs());

it("starts Google OAuth with the application callback", async () => {
  const response = await GET(new Request("http://localhost:8000/api/auth/google"));

  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://accounts.google.com/start");
  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "http://localhost:8000/api/auth/callback" } });
});

it("returns to sign-in when OAuth cannot start", async () => {
  signInWithOAuth.mockResolvedValue({ data: { url: null }, error: new Error("provider disabled") });

  const response = await GET(new Request("http://localhost:8000/api/auth/google"));

  expect(response.headers.get("location")).toBe("http://localhost:8000/?authError=google");
});

it("uses tryhomework on Vercel production despite an old base URL", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");

  await GET(new Request("http://localhost:3000/api/auth/google"));

  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://tryhomework.vercel.app/api/auth/callback" } });
});
