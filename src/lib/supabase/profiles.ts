import "server-only";
import { savedProfileSchema, type HousingProfile, type SavedProfile } from "@/lib/contracts/housing-profile";
import type { Weights } from "@/lib/contracts/matching-weights";

export async function profilesRequest(userId: string, profile?: SavedProfile): Promise<SavedProfile[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Profile storage is not configured.");
  const response = await fetch(
    url.replace(/\/$/, "") + "/rest/v1/housing_profiles?select=id,profile" + (profile ? "" : "&owner_id=eq." + encodeURIComponent(userId) + "&order=created_at.desc&limit=1"),
    {
      method: profile ? "POST" : "GET",
      headers: {
        apikey: key,
        ...(key.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + key }),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: profile ? JSON.stringify({ ...profile, owner_id: userId }) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error("Profile storage is unavailable.");
  return savedProfileSchema.array().parse(await response.json());
}

export async function updateProfileWeights(userId: string, profileId: string, weights: Weights): Promise<SavedProfile> {
  const profile = (await profilesRequest(userId)).find(row => row.id === profileId);
  if (!profile) throw new Error("Profile not found.");

  return updateProfile(userId, profileId, { ...profile.profile, weights });
}

export async function updateProfile(userId: string, profileId: string, profile: HousingProfile): Promise<SavedProfile> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Profile storage is not configured.");
  const query = new URLSearchParams({ select: "id,profile", id: `eq.${profileId}`, owner_id: `eq.${userId}` });
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/housing_profiles?${query}`, {
    method: "PATCH",
    headers: { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ profile }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Could not save your profile.");
  const [updated] = savedProfileSchema.array().parse(await response.json());
  if (!updated) throw new Error("Profile not found.");
  return updated;
}
