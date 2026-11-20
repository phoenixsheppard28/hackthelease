import { describe, expect, it } from "vitest";
import { combineGroupMatches } from "./group-ranking";
import type { ListingMatchesResponse } from "@/lib/contracts/listing-match";

function response(matches: { id: string; score: number | null }[]): ListingMatchesResponse {
  return {
    matches: matches.map(({ id, score }) => ({ id, score }) as ListingMatchesResponse["matches"][number]),
    totalListings: 3,
    notices: [],
  };
}

describe("combineGroupMatches", () => {
  it("excludes homes that fail one member and averages shared scores", () => {
    const result = combineGroupMatches([
      response([{ id: "a", score: 80 }, { id: "b", score: 90 }]),
      response([{ id: "a", score: 60 }, { id: "c", score: 100 }]),
    ]);

    expect(result.matches.map(home => [home.id, home.score])).toEqual([["a", 70]]);
  });

  it("averages available scores and reports the number of contributors", () => {
    const result = combineGroupMatches([
      response([{ id: "a", score: null }]),
      response([{ id: "a", score: 80 }]),
    ]);

    expect(result.matches[0].score).toBe(80);
    expect(result.matches[0].scoreCoverage).toEqual({ scored: 1, total: 2 });
  });
});
