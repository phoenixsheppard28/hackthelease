import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { authClient } from "@/lib/supabase/auth";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ authClient: vi.fn() }));

const exchangeCodeForSession = vi.fn();

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  vi.mocked(authClient).mockResolvedValue({ auth: { exchangeCodeForSession } } as never);
});

it("exchanges the code and sends the student to groups", async () => {
  const response = await GET(new Request("http://localhost:8000/api/auth/callback?code=abc"));

  expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  expect(response.headers.get("location")).toBe("http://localhost:8000/groups");
});

it("rejects a missing code", async () => {
  const response = await GET(new Request("http://localhost:8000/api/auth/callback"));

  expect(exchangeCodeForSession).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe("http://localhost:8000/?authError=google");
});

it("returns to sign-in when exchange fails", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });

  const response = await GET(new Request("http://localhost:8000/api/auth/callback?code=abc"));

  expect(response.headers.get("location")).toBe("http://localhost:8000/?authError=google");
});
