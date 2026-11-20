import { requiredBedrooms, type HousingProfile } from "../contracts/housing-profile";
import type { HousingProfile as CoreProfile } from "@/lib/contracts/housing";
import type { ListingMatch, ListingMatchesResponse } from "@/lib/contracts/listing-match";
import type { Weights } from "@/lib/contracts/matching-weights";
import type { CatalogListing } from "@/lib/supabase/listing-catalog";
import { cosineSimilarity, rankListings } from "./rank";

export function matchingProfile(profile: HousingProfile): CoreProfile {
  return {
    budgetMonthlyPerPerson: profile.basis === "Just me" ? profile.budget : profile.budget / (profile.roommates + 1),
    minimumBeds: requiredBedrooms(profile),
    roommateCount: profile.roommates, moveInDate: null, requiresAccessibleUnit: false,
    preferredAmenities: [],
    lifestyleText: [profile.interests, `Meals: ${profile.food}. Going out: ${profile.night}.`].filter(Boolean).join("\n"),
    priorities: ["affordability", "amenities", "lifestyle"],
  };
}

function safeSource(value: string): string | null {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}

export function rankCatalog(profile: HousingProfile, weights: Weights, catalog: CatalogListing[], embedding: number[] | null, detail = false): ListingMatchesResponse {
  const coreProfile = matchingProfile(profile);
  const ranked = new Map(rankListings(coreProfile, catalog, embedding).map(result => [result.listingId, result]));
  const notices: string[] = [];
  if (!embedding) notices.push("Semantic lifestyle matching is unavailable. Lifestyle is not included in the score.");
  notices.push("Home fit currently checks bedrooms. House or apartment type and room-sharing rules need verification.");
  const matches: ListingMatch[] = [];
  for (const entry of catalog) {
    const { listing } = entry;
    const result = ranked.get(listing.id);
    if (!result && !detail) continue;
    const lifestyleKnown = Boolean(embedding && entry.embedding && cosineSimilarity(embedding, entry.embedding) !== null);
    const components: ListingMatch["components"] = [
      { label: "Location", score: null, weight: weights.Location },
      { label: "Budget", score: result ? Math.round(result.componentScores.affordability! * 100) : null, weight: weights.Budget },
      { label: "Home fit", score: result ? listing.beds === null ? 50 : 100 : null, weight: weights["Home fit"] },
      { label: "Lifestyle", score: result && lifestyleKnown ? Math.round(result.componentScores.lifestyle! * 100) : null, weight: weights.Lifestyle },
    ];
    const supported = components.filter(component => component.score !== null && component.weight > 0);
    const totalWeight = supported.reduce((sum, component) => sum + component.weight, 0);
    const score = result && totalWeight ? Math.round(supported.reduce((sum, component) => sum + component.score! * component.weight, 0) / totalWeight) : null;
    const divisor = listing.rentBasis === "per_unit" ? profile.roommates + 1 : 1;
    const perPersonRent = listing.rentMin === null || listing.rentBasis === "unknown" ? null : { min: listing.rentMin / divisor, max: (listing.rentMax ?? listing.rentMin) / divisor };
    const flags = result ? result.verificationFlags.filter(flag => !flag.startsWith("Uncertain:")) : ["This home does not meet your current budget or bedroom requirements."];
    flags.push("Property type and permitted occupancy need verification.");
    if (listing.availableFrom && listing.availableFrom < new Date().toISOString().slice(0, 10)) flags.push("The listed availability date is in the past; confirm current availability.");
    if (profile.bus !== null && profile.car === "No") flags.push("Distance to a bus stop needs verification.");
    const reasons = result ? result.supportingFacts.slice(0, 4) : [];
    const unit = listing.unit && !/^(null|undefined|n\/a)$/i.test(listing.unit.trim()) ? listing.unit : null;
    matches.push({
      id: listing.id, name: listing.address.split(",")[0] + (unit ? ` · ${unit}` : ""),
      address: listing.address, area: listing.address.split(",").slice(1).join(",").trim() || "Ann Arbor", unit: listing.unit,
      type: null, beds: listing.beds, rent: listing.rentMin, rentMax: listing.rentMax, rentBasis: listing.rentBasis,
      recurringFeesMonthly: listing.recurringFeesMonthly, perPersonRent,
      image: entry.images[0] ?? null, images: entry.images, description: listing.description,
      features: [...new Set([...listing.features, ...Object.entries(listing.amenities).filter(([, present]) => present === true).map(([name]) => name)])],
      contact: listing.contact, sourceUrl: listing.sources.map(source => safeSource(source.url)).find(Boolean) ?? null,
      sourceFetchedAt: entry.refreshedAt, availableFrom: listing.availableFrom, score, components,
      destinations: profile.hubs.map(name => ({ name, minutes: null, distanceMeters: null, status: 'unavailable', checkedAt: null })), reasons, verificationFlags: [...new Set(flags)], firmChecks: result?.firmChecks ?? {},
    });
  }
  matches.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id));
  return { matches, totalListings: catalog.length, notices };
}
