import type { Listing } from "../contracts/housing";

export const demoListings: Listing[] = [
  {
    id: "demo-oxford-1",
    address: "625 South State Street, Ann Arbor, MI",
    unit: "2B",
    rentMin: 980,
    rentMax: 980,
    rentBasis: "per_person",
    recurringFeesMonthly: 0,
    beds: 2,
    availableFrom: "2027-08-20",
    accessible: null,
    amenities: { laundry: true, parking: false },
    features: ["Shared kitchen", "Near Central Campus"],
    description: "Demo listing for ranking and layout work.",
    contact: null,
    sources: [
      {
        url: "https://example.com/demo/oxford-1",
        fetchedAt: "2026-11-19T20:00:00Z",
        evidence: "Synthetic fixture. Monthly rent is per person.",
      },
    ],
    isActive: true,
  },
  {
    id: "demo-cabrio-1",
    address: "1100 Broadway Street, Ann Arbor, MI",
    unit: "4A",
    rentMin: 2200,
    rentMax: 2200,
    rentBasis: "per_unit",
    recurringFeesMonthly: 0,
    beds: 2,
    availableFrom: "2027-08-20",
    accessible: true,
    amenities: { laundry: true, parking: true },
    features: ["Modern kitchen", "Near North Campus"],
    description: "Demo listing for ranking and layout work.",
    contact: null,
    sources: [
      {
        url: "https://example.com/demo/cabrio-1",
        fetchedAt: "2026-11-19T20:00:00Z",
        evidence: "Synthetic fixture. Monthly rent is per unit.",
      },
    ],
    isActive: true,
  },
];
