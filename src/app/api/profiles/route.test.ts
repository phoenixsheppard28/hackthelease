import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/supabase/auth", () => ({ currentStudent: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/supabase/profiles", () => ({ profilesRequest: vi.fn() }));

describe("GET /api/profiles", () => {
  it("rejects signed-out requests before reading saved profiles", async () => {
    expect((await GET()).status).toBe(401);
  });
});
