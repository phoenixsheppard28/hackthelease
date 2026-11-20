import { z } from "zod";
import { housingProfileSchema } from "@/lib/contracts/housing-profile";
import { weightsSchema } from "@/lib/contracts/matching-weights";

export const browseContextSchema = z.object({
  profile: housingProfileSchema,
  weights: weightsSchema,
  query: z.string().default(""),
  homeType: z.enum(["All homes", "Apartment", "House"]).default("All homes"),
  view: z.enum(["homes", "saved"]).default("homes"),
});
export type BrowseContext = z.infer<typeof browseContextSchema>;
// Only completed profiles, scoped to the current browser session.
const key = (id: string) => `hackthelease:browse:${id}`;
export function saveBrowseContext(id: string, context: BrowseContext) {
  try { sessionStorage.setItem(key(id), JSON.stringify(context)); } catch { /* Saved profiles can be reloaded from the server. */ }
}
export function readBrowseContext(id: string): BrowseContext | null {
  try { return browseContextSchema.parse(JSON.parse(sessionStorage.getItem(key(id)) || "null")); }
  catch { return null; }
}
export const matchesHref = (id: string) => `/matches?profile=${encodeURIComponent(id)}`;
