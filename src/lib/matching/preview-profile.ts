import { housingProfileSchema } from "@/lib/contracts/housing-profile";

// A read-only fixture for reviewing the browser; never creates a student record.
export const previewProfile = housingProfileSchema.parse({
  name: "Preview student", budget: 1100, basis: "Just me",
  hubs: ["Hatcher Library", "IM Building", "Fishbowl"],
  walk: { "Hatcher Library": 15, "IM Building": 15, Fishbowl: 15 },
  roommates: 1, type: "Apartment", share: "No", occupancy: 1,
  car: "No", bus: null, year: "Junior", major: "Computer Science",
  night: "Sometimes", food: "Cook at home", group: "Already have a group",
  interests: "Basketball and studying at the Fishbowl", schedule: [],
});
