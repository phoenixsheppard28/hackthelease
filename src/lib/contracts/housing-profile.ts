import { z } from "zod";
import { defaultWeights, weightsSchema } from "./matching-weights";

export const campusHubs = [
  "Hatcher Library", "Target on State", "IM Building", "Duderstadt Center",
  "Fishbowl", "Michigan Union", "Ross",
] as const;

const minutes = z.number().int().min(1).max(120);
export const housingProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  budget: z.number().int().min(1).max(100000),
  basis: z.enum(["Just me", "Our whole group"]),
  hubs: z.array(z.enum(campusHubs)).length(3).refine(hubs => new Set(hubs).size === 3),
  // Missing destination keys mean no walking limit, not a default limit.
  walk: z.record(z.string(), minutes).default({}),
  roommates: z.number().int().min(0).max(20),
  type: z.enum(["House", "Apartment", "Either"]),
  share: z.enum(["Yes", "No"]),
  occupancy: z.number().int().min(1).max(21),
  // Older saved profiles omit this field and retain their inferred room count.
  bedrooms: z.number().int().min(1).max(21).optional(),
  car: z.enum(["Yes", "No"]),
  bus: minutes.nullable().default(null),
  year: z.enum(["First year", "Sophomore", "Junior", "Senior", "Graduate", "Other"]),
  major: z.string().trim().min(1).max(200),
  night: z.enum(["Often", "Sometimes", "Rarely"]),
  food: z.enum(["Dining hall", "Cook at home", "A mix"]),
  group: z.enum(["Already have a group", "Open to random roommates", "A mix"]).nullable(),
  interests: z.string().trim().max(4000),
  weights: weightsSchema.refine(weights => Object.values(weights).some(value => value > 0),
    "Give at least one preference some importance.").default(defaultWeights),
  schedule: z.array(z.object({
    time: z.string(),
    location: z.string(),
    hub: z.enum(campusHubs),
  })).default([]),
  calendarDestinations: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    address: z.string().trim().min(5).max(200).regex(/\d/, "Enter a street address."),
    count: z.number().int().min(20).max(2500),
  })).max(4).refine(places => new Set(places.map(place => place.name.toLowerCase())).size === places.length,
    "Use a different name for each Calendar place.").default([]),
}).superRefine((profile, context) => {
  if (profile.occupancy > profile.roommates + 1) {
    context.addIssue({ code: "custom", path: ["occupancy"], message: "Room occupancy cannot exceed your group size." });
  }
  const roomsForGroup = Math.ceil((profile.roommates + 1) / (profile.share === "Yes" ? profile.occupancy : 1));
  if (profile.bedrooms !== undefined && profile.bedrooms < roomsForGroup) {
    context.addIssue({ code: "custom", path: ["bedrooms"], message: `Your group needs at least ${roomsForGroup} bedrooms with your room-sharing choice.` });
  }
});

export type HousingProfile = z.infer<typeof housingProfileSchema>;
export type CalendarDestination = HousingProfile["calendarDestinations"][number];
export function requiredBedrooms(profile: Pick<HousingProfile, "bedrooms" | "roommates" | "occupancy">): number {
  return profile.bedrooms ?? Math.ceil((profile.roommates + 1) / profile.occupancy);
}
export type ProfileDraft = Partial<HousingProfile>;
export type SavedProfile = { id: string; profile: HousingProfile };
export const savedProfileSchema = z.object({ id: z.uuid(), profile: housingProfileSchema });
