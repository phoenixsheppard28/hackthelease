import type { HousingProfile } from "@/lib/contracts/housing-profile";
import { campusHubs, requiredBedrooms } from "@/lib/contracts/housing-profile";
import type { Weights } from "@/lib/contracts/matching-weights";
import { listingMedia } from "./listing-media";

// Illustrative fixtures retained from the original demo. Replace through /api/rank
// when the team's ingestion and matching implementation is ready.
const homes = [
  { name: "State Street Flats", rent: 1080, type: "Apartment", beds: 2, walk: [6, 3, 15, 55, 5, 6, 12], bus: 3, food: "Dining hall", night: "Often" },
  { name: "Hoover House", rent: 870, type: "House", beds: 4, walk: [16, 18, 4, 65, 18, 13, 10], bus: 6, food: "Cook at home", night: "Sometimes" },
  { name: "North Campus Court", rent: 760, type: "Apartment", beds: 3, walk: [54, 52, 67, 5, 50, 56, 62], bus: 2, food: "Cook at home", night: "Rarely" },
  { name: "East Quad Apartments", rent: 990, type: "Apartment", beds: 3, walk: [9, 13, 12, 58, 11, 9, 4], bus: 4, food: "Dining hall", night: "Often" },
];
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function rankDemoListings(profile: HousingProfile, weights: Weights) {
  const budget = profile.basis === "Just me" ? profile.budget : profile.budget / (profile.roommates + 1);
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!total) return [];
  return homes.map(home => {
    const walk = (hub: string) => home.walk[campusHubs.indexOf(hub as typeof campusHubs[number])];
    const destinations = [...profile.hubs, ...profile.schedule.map(event => event.hub)];
    const proximity = destinations.flatMap(hub => {
      const limit = profile.walk[hub];
      return limit === undefined ? [] : [Math.min(1, limit / walk(hub))];
    });
    if (profile.car === "No" && profile.bus) proximity.push(Math.min(1, profile.bus / home.bus));
    const interests = profile.interests.toLowerCase();
    const favorites: string[] = campusHubs.filter(hub => interests.includes(hub.split(" ")[0].toLowerCase()));
    if (/basketball|gym|workout/.test(interests)) favorites.push("IM Building");
    const lifestyle = [
      profile.food === "A mix" || profile.food === home.food ? 1 : .4,
      profile.night === home.night ? 1 : .5,
      ...favorites.map(hub => Math.min(1, 8 / walk(hub))),
    ];
    const scores = [
      proximity.length ? mean(proximity) : 1,
      Math.max(0, 1 - home.rent / budget * .45 - Math.max(0, home.rent / budget - 1)),
      mean([profile.type === "Either" || profile.type === home.type ? 1 : 0, home.beds >= requiredBedrooms(profile) ? 1 : 0]),
      mean(lifestyle),
    ];
    const score = Math.round(100 * scores.reduce((sum, value, index) => sum + value * Object.values(weights)[index], 0) / total);
    return { ...home, ...listingMedia[home.name], score,
      components: Object.keys(weights).map((label, index) => ({ label, score: Math.round(scores[index] * 100), weight: Object.values(weights)[index] })),
      destinations: profile.hubs.map(hub => ({ name: hub, minutes: walk(hub) })) };
  }).sort((a, b) => b.score - a.score);
}
export type DemoMatch = ReturnType<typeof rankDemoListings>[number];
