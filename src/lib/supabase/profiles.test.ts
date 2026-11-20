import { beforeEach, describe, expect, it, vi } from "vitest";
import { profilesRequest, updateProfile } from "./profiles";
import { previewProfile } from "@/lib/matching/preview-profile";

vi.mock("server-only", () => ({}));

const ownerId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
});

describe("profilesRequest", () => {
  it("filters profile reads by the authenticated owner", async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([]));
    vi.stubGlobal("fetch", fetcher);

    await profilesRequest(ownerId);

    expect(String(fetcher.mock.calls[0][0])).toContain(`owner_id=eq.${ownerId}`);
    expect(String(fetcher.mock.calls[0][0])).toContain("order=created_at.desc&limit=1");
  });

  it("writes the authenticated owner rather than a client owner", async () => {
    const saved = { id: "22222222-2222-4222-8222-222222222222", profile: previewProfile };
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([saved]));
    vi.stubGlobal("fetch", fetcher);

    await profilesRequest(ownerId, saved);

    const request = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ id: saved.id, owner_id: ownerId });
  });

  it("updates one saved profile for its authenticated owner", async () => {
    const saved = { id: "22222222-2222-4222-8222-222222222222", profile: { ...previewProfile, budget: 1400 } };
    const fetcher = vi.fn(async () => Response.json([saved]));
    vi.stubGlobal("fetch", fetcher);

    await updateProfile(ownerId, saved.id, saved.profile);

    const [url, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`owner_id=eq.${ownerId}`);
    expect(url).toContain(`id=eq.${saved.id}`);
    expect(request.method).toBe("PATCH");
    expect(JSON.parse(String(request.body))).toEqual({ profile: saved.profile });
  });
});
