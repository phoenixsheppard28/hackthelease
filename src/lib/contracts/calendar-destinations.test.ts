import { expect, it } from "vitest";
import { housingProfileSchema } from "./housing-profile";
import { previewProfile } from "@/lib/matching/preview-profile";

it("accepts reviewed recurring destinations and rejects missing addresses", () => {
  const destination = { name: "Chem Building", address: "930 N University Ave, Ann Arbor, MI", count: 24 };
  expect(housingProfileSchema.safeParse({ ...previewProfile, calendarDestinations: [destination] }).success).toBe(true);
  expect(housingProfileSchema.safeParse({ ...previewProfile, calendarDestinations: [{ ...destination, address: "" }] }).success).toBe(false);
  expect(housingProfileSchema.safeParse({ ...previewProfile, calendarDestinations: [destination, { ...destination, address: "123 Other St" }] }).success).toBe(false);
  expect(housingProfileSchema.safeParse({ ...previewProfile, calendarDestinations: Array.from({ length: 5 }, (_, index) => ({ ...destination, name: `Place ${index}` })) }).success).toBe(false);
});
