import type { Listing, MatchResult } from "./housing";
import type { Weights } from "./matching-weights";
import type { DestinationWalk } from "../travel/types";
import type { ListingAvailability } from '../availability/listing-status';

export type ListingMatch = {
  id: string;
  name: string;
  address: string;
  area: string;
  unit: string | null;
  type: "House" | "Apartment" | null;
  beds: number | null;
  rent: number | null;
  rentMax: number | null;
  rentBasis: Listing["rentBasis"];
  recurringFeesMonthly: number | null;
  perPersonRent: { min: number; max: number } | null;
  image: string | null;
  images: string[];
  description: string | null;
  features: string[];
  contact: Listing["contact"];
  sourceUrl: string | null;
  sourceFetchedAt: string;
  availableFrom: string | null;
  availabilityReport?: ListingAvailability | null;
  score: number | null;
  scoreCoverage?: { scored: number; total: number };
  components: { label: keyof Weights; score: number | null; weight: number }[];
  destinations: DestinationWalk[];
  reasons: string[];
  verificationFlags: string[];
  firmChecks: MatchResult["firmChecks"];
};

export type ListingMatchesResponse = {
  matches: ListingMatch[];
  totalListings: number;
  notices: string[];
};

export const formatMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
export function rentText(home: Pick<ListingMatch, "rent" | "rentMax">) {
  if (home.rent === null) return "Ask for rent";
  return home.rentMax !== null && home.rentMax !== home.rent ? `${formatMoney(home.rent)}–${formatMoney(home.rentMax)}` : formatMoney(home.rent);
}
export function rentBasisText(home: Pick<ListingMatch, "rent" | "rentBasis">) {
  if (home.rent === null) return "";
  return home.rentBasis === "per_person" ? " / person / month" : home.rentBasis === "per_unit" ? " / unit / month" : " / month · basis unconfirmed";
}
