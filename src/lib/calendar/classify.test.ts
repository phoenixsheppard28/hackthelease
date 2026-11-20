import { afterEach, expect, it, vi } from "vitest";
import { classifyPlaces } from "./classify";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('combines title-only room variants with explicit locations at the same building', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  expect(await classifyPlaces([
    { title: 'Leinweber 2421', location: '', count: 8 },
    { title: 'Class', location: 'Leinweber 1125', count: 3 },
    { title: 'Study', location: '2200 Hayward St, Ann Arbor, MI 48109', count: 2 },
    { title: 'study', location: '', count: 50 },
    { title: 'coffee chat', location: '', count: 30 },
  ])).toEqual([{ name: 'Leinweber Building', address: '2200 Hayward St, Ann Arbor, MI 48109', count: 13 }]);
});

it('prefers the specified location over a building mentioned in the title', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  expect(await classifyPlaces([{ title: 'Leinweber class study group', location: 'Hatcher Library', count: 3 }]))
    .toEqual([{ name: 'Hatcher Library', address: '913 S University Ave, Ann Arbor, MI 48109', count: 3 }]);
});

it('uses AI to resolve other named buildings in titles and excludes generic tasks', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  const fetchModel = vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ places: [
    { index: 0, name: 'Chemistry Building', address: '930 N University Ave, Ann Arbor, MI', physical: true },
    { index: 1, name: '', address: '', physical: false },
    { index: 2, name: '', address: '', physical: false },
  ] }) }] }] }));
  vi.stubGlobal('fetch', fetchModel);
  expect(await classifyPlaces([
    { title: 'Chemistry Building 1800', location: '', count: 7 },
    { title: 'study', location: '', count: 6 },
    { title: 'coffee chat', location: '', count: 5 },
  ])).toEqual([{ name: 'Chemistry Building', address: '930 N University Ave, Ann Arbor, MI', count: 7 }]);
  const sent = JSON.parse(fetchModel.mock.calls[0][1].body);
  expect(JSON.parse(sent.input)[0].title).toBe('Chemistry Building 1800');
});

it("uses AI for place labels but preserves server-counted visits", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const fetchModel = vi.fn().mockResolvedValue(Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ places: [{ index: 0, name: "Chem Building", address: "930 N University Ave, Ann Arbor, MI", physical: true }] }) }] }] }));
  vi.stubGlobal("fetch", fetchModel);

  const places = await classifyPlaces([{ title: "Chemistry", location: "Chem Bldg", count: 24 }]);

  expect(places).toEqual([{ name: "Chem Building", address: "930 N University Ave, Ann Arbor, MI", count: 24 }]);
  expect(fetchModel).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({ method: "POST" }));
});

it("omits unresolved places instead of asking for an address when AI is unavailable", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");

  expect(await classifyPlaces([{ title: "Class", location: "Unknown room", count: 20 }]))
    .toEqual([]);
});

it('resolves a known building abbreviation without relying on AI', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ places: [{ index: 0, name: '', address: '', physical: false }] }) }] }] })));
  expect(await classifyPlaces([{ title: 'EECS 280', location: 'BBB 1690', count: 8 }])).toEqual([{ name: 'Beyster Building', address: '2260 Hayward St, Ann Arbor, MI 48105', count: 8 }]);
});

it("does not duplicate a place when AI repeats its index", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const suggestion = { index: 0, name: "Chem Building", address: "930 N University Ave, Ann Arbor, MI", physical: true };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ places: [suggestion, suggestion] }) }] }] })));

  expect(await classifyPlaces([{ title: "Chemistry", location: "Chem Bldg", count: 24 }])).toHaveLength(1);
});

it("omits unresolved places beyond the AI batch", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const places = Array.from({ length: 21 }, (_, index) => ({ title: `Class ${index}`, location: `Place ${index}`, count: 20 }));

  expect(await classifyPlaces(places)).toHaveLength(0);
});
