import type { ListingMatchesResponse } from "@/lib/contracts/listing-match";

export function combineGroupMatches(results: ListingMatchesResponse[]): ListingMatchesResponse {
  if (!results.length) return { matches: [], totalListings: 0, notices: ["Complete a profile to rank homes for your group."] };

  const others = results.slice(1).map(result => new Map(result.matches.map(home => [home.id, home])));
  const matches = results[0].matches.flatMap(home => {
    const memberHomes = [home, ...others.map(result => result.get(home.id))];
    if (memberHomes.some(memberHome => !memberHome)) return [];
    const shared = memberHomes as typeof results[0]["matches"];
    const scored = shared.filter(memberHome => memberHome.score !== null);
    const score = scored.length ? Math.round(scored.reduce((sum, memberHome) => sum + memberHome.score!, 0) / scored.length) : null;

    return [{ ...home, score, scoreCoverage: { scored: scored.length, total: shared.length }, components: [], destinations: [], reasons: [], verificationFlags: [...new Set(shared.flatMap(memberHome => memberHome.verificationFlags))] }];
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id));

  return {
    matches,
    totalListings: results[0].totalListings,
    notices: [`Group scores combine ${results.length} completed profiles equally. A home must fit every member's confirmed requirements.`, ...results.flatMap(result => result.notices).filter((notice, index, all) => all.indexOf(notice) === index)],
  };
}
