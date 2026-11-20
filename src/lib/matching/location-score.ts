import type { HousingProfile } from '../contracts/housing-profile';
import type { ListingMatch } from '../contracts/listing-match';
import type { Weights } from '../contracts/matching-weights';
import type { DestinationWalk } from '../travel/types';

// A product heuristic, not a probability, with a 30-minute exponential decay scale.
// Calendar weights scale from one manual destination per 20 visits. Optional limits add a penalty.
export const calendarRouteName = (name: string) => `Calendar · ${name}`;

export function locationScore(places: DestinationWalk[], profile: Pick<HousingProfile, 'hubs' | 'walk' | 'calendarDestinations'>): number | null {
  const visits = [
    ...profile.hubs.map(name => ({ name, weight: 1 })),
    ...profile.calendarDestinations.map(place => ({ name: calendarRouteName(place.name), weight: place.count / 20 })),
  ];
  const scores = visits.map(({ name, weight }) => {
    const place = places.find(item => item.name === name);
    if (!place || place.status !== 'ok' || place.minutes === null || !Number.isFinite(place.minutes) || place.minutes < 0) return null;
    const limit = profile.walk[name];
    const penalty = limit !== undefined && place.minutes > limit ? limit / place.minutes : 1;
    return { score: 100 * Math.exp(-place.minutes / 30) * penalty, weight };
  });
  if (!scores.length || scores.some(score => score === null)) return null;
  return Math.round(scores.reduce((sum, item) => sum + item!.score * item!.weight, 0) / visits.reduce((sum, item) => sum + item.weight, 0));
}

export function walkingSummary(home: Pick<ListingMatch, 'destinations'>, walk: HousingProfile['walk']): string {
  if (!home.destinations.length || home.destinations.some(place => place.status !== 'ok' || place.minutes === null)) return 'Walking estimates incomplete';
  const limited = home.destinations.filter(place => walk[place.name] !== undefined);
  if (limited.length) {
    const within = limited.filter(place => place.minutes! <= walk[place.name]).length;
    return `Within ${within} of ${limited.length} walking preferences`;
  }
  const average = Math.round(home.destinations.reduce((sum, place) => sum + place.minutes!, 0) / home.destinations.length);
  return `${average} min average walk to your places`;
}

export function locationIncomplete(home: ListingMatch, weights: Weights): boolean {
  return weights.Location > 0 && home.components.find(component => component.label === 'Location')?.score == null;
}

// Shared by server, shortlist, and detail. This function never fetches anything.
export function reweightMatches(homes: ListingMatch[], weights: Weights): ListingMatch[] {
  return homes.map(home => {
    const components = home.components.map(component => ({ ...component, weight: weights[component.label] }));
    const supported = components.filter(component => component.score !== null && component.weight > 0);
    const total = supported.reduce((sum, component) => sum + component.weight, 0);
    const failed = Object.values(home.firmChecks).includes('fail') || home.verificationFlags.some(flag => flag.startsWith('This home does not meet'));
    const score = failed || !total ? null : Math.round(supported.reduce((sum, component) => sum + component.score! * component.weight, 0) / total);
    return { ...home, components, score };
  }).sort((a, b) => Number(locationIncomplete(a, weights)) - Number(locationIncomplete(b, weights)) || (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id));
}
