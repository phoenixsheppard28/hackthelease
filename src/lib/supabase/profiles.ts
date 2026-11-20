import "server-only";
import { savedProfileSchema, type SavedProfile } from "@/lib/contracts/housing-profile";

export async function profilesRequest(profile?: SavedProfile): Promise<SavedProfile[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Profile storage is not configured.");
  const response = await fetch(
    url.replace(/\/$/, "") + "/rest/v1/housing_profiles?select=id,profile" + (profile ? "&on_conflict=id" : ""),
    {
      method: profile ? "POST" : "GET",
      headers: {
        apikey: key,
        ...(key.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + key }),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: profile ? JSON.stringify(profile) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error("Profile storage is unavailable.");
  return savedProfileSchema.array().parse(await response.json());
}
