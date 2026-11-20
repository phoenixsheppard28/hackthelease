import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { currentStudent } from "@/lib/supabase/auth";
import { groupProfiles } from "@/lib/groups/store";

vi.mock("@/lib/supabase/auth", () => ({ currentStudent: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/groups/store", () => ({ groupProfiles: vi.fn() }));
vi.mock("@/lib/matching/live-ranking", () => ({ rankLiveGroup: vi.fn() }));

describe("GET /api/groups/rank", () => {
  it("rejects unsigned requests before reading group profiles", async () => {
    const response = await GET(new Request("http://localhost/api/groups/rank"));
    expect(response.status).toBe(401);
    expect(groupProfiles).not.toHaveBeenCalled();
  });

  it("does not rank for a student without group membership", async () => {
    vi.mocked(currentStudent).mockResolvedValueOnce({ id: "student", email: "student@example.com" });
    vi.mocked(groupProfiles).mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/api/groups/rank"));
    expect(response.status).toBe(404);
  });
});
