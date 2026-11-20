import { describe, expect, it, vi } from "vitest";
import { previewProfile } from "@/lib/matching/preview-profile";
import { PATCH } from "./route";
import { updateProfile } from "@/lib/supabase/profiles";

vi.mock("@/lib/supabase/auth", () => ({ currentStudent: vi.fn().mockResolvedValue({ id: "owner-id" }) }));
vi.mock("@/lib/supabase/profiles", () => ({ updateProfile: vi.fn(), updateProfileWeights: vi.fn() }));

const id = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ id }) };

describe("PATCH /api/profiles/[id]", () => {
  it("updates one profile answer for the signed-in student", async () => {
    const profile = { ...previewProfile, budget: 1400 };
    vi.mocked(updateProfile).mockResolvedValue({ id, profile });

    const response = await PATCH(new Request("http://localhost/api/profiles/" + id, { method: "PATCH", body: JSON.stringify(profile) }), context);

    expect(response.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith("owner-id", id, profile);
  });

  it("rejects invalid profile answers before storage", async () => {
    vi.mocked(updateProfile).mockClear();

    const response = await PATCH(new Request("http://localhost/api/profiles/" + id, { method: "PATCH", body: JSON.stringify({ ...previewProfile, budget: -1 }) }), context);

    expect(response.status).toBe(400);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
