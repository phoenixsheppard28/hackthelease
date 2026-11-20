import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { authClient } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ authClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: vi.fn() }));

const createUser = vi.fn();
const signInWithPassword = vi.fn();

beforeEach(() => {
  createUser.mockReset().mockResolvedValue({ error: null });
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  vi.mocked(supabaseAdmin).mockReturnValue({ auth: { admin: { createUser } } } as never);
  vi.mocked(authClient).mockResolvedValue({ auth: { signInWithPassword } } as never);
});

it("creates a confirmed password account without an email flow", async () => {
  const request = new Request("http://localhost/api/auth/sign-up", { method: "POST", body: JSON.stringify({ email: "Student@School.edu", password: "passphrase123" }) });
  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(createUser).toHaveBeenCalledWith({ email: "student@school.edu", password: "passphrase123", email_confirm: true });
  expect(signInWithPassword).toHaveBeenCalledWith({ email: "student@school.edu", password: "passphrase123" });
});

it("rejects a short password before creating an account", async () => {
  const request = new Request("http://localhost/api/auth/sign-up", { method: "POST", body: JSON.stringify({ email: "student@school.edu", password: "short" }) });
  const response = await POST(request);

  expect(response.status).toBe(400);
  expect(createUser).not.toHaveBeenCalled();
});
