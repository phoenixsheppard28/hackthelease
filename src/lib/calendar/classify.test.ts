import { afterEach, expect, it, vi } from "vitest";
import { classifyPlaces } from "./classify";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("uses AI for place labels but preserves server-counted visits", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const fetchModel = vi.fn().mockResolvedValue(Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ places: [{ index: 0, name: "Chem Building", address: "930 N University Ave, Ann Arbor, MI", physical: true }] }) }] }] }));
  vi.stubGlobal("fetch", fetchModel);

  const places = await classifyPlaces([{ title: "Chemistry", location: "Chem Bldg", count: 24 }]);

  expect(places).toEqual([{ name: "Chem Building", address: "930 N University Ave, Ann Arbor, MI", count: 24 }]);
  expect(fetchModel).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({ method: "POST" }));
});

it("keeps a manual review option when AI is unavailable", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");

  expect(await classifyPlaces([{ title: "Class", location: "Unknown room", count: 20 }]))
    .toEqual([{ name: "Unknown room", address: "", count: 20 }]);
});

it("does not duplicate a place when AI repeats its index", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const suggestion = { index: 0, name: "Chem Building", address: "930 N University Ave, Ann Arbor, MI", physical: true };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ places: [suggestion, suggestion] }) }] }] })));

  expect(await classifyPlaces([{ title: "Chemistry", location: "Chem Bldg", count: 24 }])).toHaveLength(1);
});

it("keeps additional frequent places for manual review beyond the AI batch", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const places = Array.from({ length: 21 }, (_, index) => ({ title: `Class ${index}`, location: `Place ${index}`, count: 20 }));

  expect(await classifyPlaces(places)).toHaveLength(21);
});
