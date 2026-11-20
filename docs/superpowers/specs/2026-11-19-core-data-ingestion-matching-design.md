# Core data, ingestion, and matching design

## Intent

Build sections 1, 2, and 4 of `task.md` for a 24-hour housing decision demo. The system must turn source pages into traceable listings and explain each ranking result.

The University of Michigan and Ann Arbor are the pilot setting. Manual profile input and the day simulation remain later work. Fixtures must support ranking before live listings arrive.

## Agreed stack

| Concern | Choice |
| --- | --- |
| Application | One Next.js App Router project with TypeScript, hosted on Vercel |
| Interface | Mantine components and Sass modules; no Tailwind |
| Client requests | TanStack Query for refresh progress and ranking updates |
| Data | Supabase Postgres with pgvector and SQL migrations |
| Source collection | Firecrawl asynchronous crawls and structured page extraction |
| Validation | Zod schemas shared by route handlers and application code |
| Embeddings | Proposed: OpenAI `text-embedding-3-small` from server routes |
| Packages | pnpm |

The browser calls only Next.js `/api/*` routes. Those routes handle authorization and call Supabase, Firecrawl, or OpenAI. No browser code imports a Supabase client or calls Supabase directly. Keep provider clients in server-only modules.

## Approaches considered

1. **One Next.js project on Vercel:** Keep pages, route handlers, and ranking code in one TypeScript project. Firecrawl runs crawls and calls a webhook. This is the selected approach because it fits the team's deployment preference and reduces setup.
2. **Next.js plus a separate Node worker:** A dedicated worker can run custom scraping for longer periods. It adds another deployment and is unnecessary while Firecrawl owns the crawl.
3. **Next.js plus Supabase Edge Functions:** This keeps ingestion close to the database. It splits backend code across two runtimes, against the team's preference for one project.

## Data model

- `sources`: Provider name, inventory URL, allowed domains, listing patterns, status, and last successful refresh time.
- `crawl_runs`: Trigger time, finish time, status, and aggregate counts.
- `crawl_run_sources`: One status and count set per source in each run. Store the Firecrawl job ID here.
- `listings`: Canonical address and unit, rent range and basis, beds, availability, features, contact, searchable text, text hash, embedding, active status, and freshness time.
- `listing_observations`: Source URL, source ID, crawl run ID, fetch time, raw extraction, normalized fields, and evidence text.

Use a normalized address and unit to merge records only when both are known. Keep records separate when the unit is unknown. Preserve conflicting source observations and show uncertainty in the canonical listing.

Use SQL migrations as the schema source. Generate Supabase database types for TypeScript. Zod validates external data and request payloads.

## Refresh flow

1. `POST /api/refresh` creates a run and starts one Firecrawl job per selected source. Return the run ID immediately.
2. Firecrawl sends page and completion events to `POST /api/firecrawl/webhook`.
3. The webhook verifies the Firecrawl signature before processing an event.
4. The backend validates extracted fields, stores observations, and updates canonical listings.
5. The backend embeds a listing only when its searchable text hash changes. A rent-only change updates structured fields.
6. `GET /api/refresh/{runId}` returns source progress and final counts. TanStack Query polls this route while a run is active.

Prevent two active runs for the same source. Restrict manual refresh to team users through Supabase Auth. Keep Firecrawl and database secret keys on the server.

If a source fails, keep its last successful listings and display their age. A source adapter may inspect another listing path on the approved domain when discovery returns no results. Report the recovery result in the run.

Mark a source observation stale after two complete, successful refreshes omit it. Keep a canonical listing active while another current source reports it. A failed or incomplete crawl never removes a listing.

## Ranking flow

`POST /api/rank` accepts a validated `HousingProfile`. The first version supports manual profile data, even before onboarding exists.

Classify each firm requirement as pass, fail, or unknown. Exclude confirmed failures. Include unknown results with a **Needs verification** flag. Never treat an unknown rent basis as a confirmed budget match.

Calculate affordability and other available structured scores with explicit formulas. Embed lifestyle preference text and compare it with listing embeddings. Use the same embedding model for both sides. Combine the student's three priority scores with 50%, 30%, and 20% weights.

The first ranker supports affordability, preferred amenities, and lifestyle fit. Budget means monthly cost per person, including known recurring fees. Divide unit rent only when the expected roommate count is known. Flag an unknown rent basis or recurring fee.

Give missing preference evidence a neutral score of 0.5 and flag it as uncertain. Do not treat an unknown amenity as present.

Return a `MatchResult` with the final score, component scores, supporting listing facts, source URLs, and verification flags. Keep raw schedule events out of embedding input.

Commute scoring waits for the shared travel estimate from section 5. Until then, the API marks commute as unavailable and does not invent travel time. Renormalize weights across supported priorities and report each skipped priority. Fixtures should show a ranking change when a supported priority changes.

## Initial routes and code boundaries

| Location | Responsibility |
| --- | --- |
| `src/app/api/refresh/*` | Start runs and return progress |
| `src/app/api/firecrawl/webhook` | Verify and process Firecrawl events |
| `src/app/api/rank` | Validate profiles and return matches |
| `src/lib/ingestion` | Source adapters, normalization, reconciliation |
| `src/lib/matching` | Firm checks, score formulas, explanations |
| `src/lib/contracts` | Zod schemas and shared types |
| `supabase/migrations` | Database schema, policies, and functions |

## Demo acceptance

Seed at least two sources and fixture listings. Refresh one source and show progress, changes, and failures. Rank a manual profile and show why each listing placed where it did. Change a priority and show the ranking response. Show source URLs, fetch times, and uncertain fields.

## Open implementation choices

- Confirm an embedding provider and API key before enabling live semantic matching. The proposed provider is OpenAI.
- Confirm the team accounts that may trigger a manual refresh. The design uses Supabase Auth.
- Inspect each selected housing source before fixing its extraction adapter.
