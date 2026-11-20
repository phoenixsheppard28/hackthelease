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
}).superRefine((profile, context) => {
  if (profile.occupancy > profile.roommates + 1) {
    context.addIssue({ code: "custom", path: ["occupancy"], message: "Room occupancy cannot exceed your group size." });
  }
});

export type HousingProfile = z.infer<typeof housingProfileSchema>;
export type ProfileDraft = Partial<HousingProfile>;
export type SavedProfile = { id: string; profile: HousingProfile };
export const savedProfileSchema = z.object({ id: z.uuid(), profile: housingProfileSchema });
