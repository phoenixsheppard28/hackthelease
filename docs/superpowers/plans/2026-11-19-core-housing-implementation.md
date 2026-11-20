# Core Housing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read `.agents/skills/ponytail/SKILL.md` before each coding task.

**Goal:** Deliver a working listing refresh and explainable ranking flow for sections 1, 2, and 4 of `task.md`.

**Architecture:** One Next.js App Router project hosts pages and API routes on Vercel. Firecrawl sends signed crawl events to a route; Supabase stores listings and embeddings. Browser code calls only the app's API routes.

**Tech Stack:** TypeScript, Next.js, Mantine, Sass modules, TanStack Query, Supabase Postgres with pgvector, Firecrawl, OpenAI embeddings, Zod, pnpm, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-core-data-ingestion-matching-design.md`

## Global Constraints

- Use pnpm for all Node package work.
- Do not use Tailwind or a browser-side Supabase client.
- Keep provider keys in server-only modules and ignored environment files.
- Keep fixture results clearly labeled as demo data.
- Use one blank line between distinct code sections and no redundant comments.
- Use the smallest complete implementation that passes the acceptance checks.

## Review Focus

- A forged Firecrawl callback must not write an observation. Task 3 tests signature rejection.
- Repeated delivery of one callback must not create duplicate observations. Task 3 tests idempotence.
- Unknown rent basis must not pass a firm budget check. Task 4 tests the unknown result.
- A failed crawl must retain prior listings. Task 3 tests the failure path.
- A changed priority order must change weighted scores deterministically. Task 4 tests ranking order.

---

## File map

| Area | Files |
| --- | --- |
| App foundation | `package.json`, Next config, TypeScript config, `src/app/layout.tsx`, `src/app/providers.tsx`, `src/styles/globals.scss` |
| Contracts and fixtures | `src/lib/contracts/*`, `src/lib/fixtures/*` |
| Database | `supabase/migrations/*`, `supabase/seed.sql`, `src/lib/supabase/*` |
| Ingestion | `src/lib/ingestion/*`, `src/app/api/refresh/*`, `src/app/api/firecrawl/webhook/route.ts` |
| Matching | `src/lib/matching/*`, `src/lib/embeddings/*`, `src/app/api/rank/route.ts` |
| Demo UI | `src/app/page.tsx`, `src/app/listings/page.tsx`, `src/components/*` |

## Task 1: App foundation and contracts

**Files:** Create `package.json`, `pnpm-lock.yaml`, Next and TypeScript config, `src/app/layout.tsx`, `src/app/providers.tsx`, `src/styles/globals.scss`, `src/lib/contracts/housing.ts`, and fixture data.

**Interfaces:** Export Zod schemas and inferred types for `Listing`, `HousingProfile`, `MatchResult`, and `CrawlRunStatus`. The later tasks consume these types.

- [ ] Define one shared listing fixture with two properties and known rent basis.
- [ ] Add a test that parses fixture listings and rejects malformed rent data.
- [ ] Run the test and confirm failure before adding the schemas.
- [ ] Implement the contracts, app shell, Mantine provider, and Query provider.
- [ ] Run `pnpm test` and `pnpm build`.

## Task 2: Database schema and server access

**Files:** Create `supabase/migrations/*`, `supabase/seed.sql`, and `src/lib/supabase/*`.

**Interfaces:** Provide server-only functions for reading listings, creating runs, storing observations, and updating canonical listings. Use the Task 1 contracts.

- [ ] Add a migration for `sources`, `crawl_runs`, `crawl_run_sources`, `listings`, and `listing_observations`.
- [ ] Enable pgvector and add the embedding column with the chosen model dimension.
- [ ] Add uniqueness and foreign-key rules for source URLs, run records, and observations.
- [ ] Add database access rules that prevent public writes. Use the server secret only after route authorization.
- [ ] Seed two source records and labeled fixture listings.
- [ ] Run the migration in a local Supabase environment and verify tables and constraints.

## Task 3: Firecrawl ingestion and refresh status

**Files:** Create `src/lib/ingestion/*`, `src/app/api/refresh/route.ts`, `src/app/api/refresh/[runId]/route.ts`, `src/app/api/firecrawl/webhook/route.ts`, and focused tests.

**Interfaces:** `startRefresh(sourceIds) → runId`; `processFirecrawlEvent(rawBody, signature) → result`; `getRefreshStatus(runId) → CrawlRunStatus`.

- [ ] Write tests for forged signatures, repeated page events, failed crawls, and address-plus-unit reconciliation.
- [ ] Run the tests and confirm they fail.
- [ ] Start one asynchronous Firecrawl job per source and return the run ID.
- [ ] Verify the Firecrawl HMAC signature before parsing or storing events.
- [ ] Validate and store page observations once. Update canonical listings without erasing prior successful data on failure.
- [ ] Return per-source progress and new, changed, and failed counts.
- [ ] Run the focused tests, `pnpm test`, and `pnpm build`.

## Task 4: Matching and embeddings

**Files:** Create `src/lib/matching/*`, `src/lib/embeddings/*`, `src/app/api/rank/route.ts`, and focused tests. Modify ingestion reconciliation to call the embedding service after a text change.

**Interfaces:** `rankListings(profile, listings) → MatchResult[]`. Use Task 1 types and Task 2 listing access.

- [ ] Write tests for firm pass/fail/unknown, per-person monthly cost, missing preference evidence, and changed priority order.
- [ ] Run the tests and confirm they fail.
- [ ] Add server-side embedding generation with `text-embedding-3-small`.
- [ ] Re-embed only when searchable listing text changes. Keep calendar events out of embedding text.
- [ ] Score affordability, preferred amenities, and lifestyle fit with 50/30/20 weights.
- [ ] Return score components, supporting facts, source URLs, and verification flags.
- [ ] Mark commute unavailable until section 5 supplies travel estimates.
- [ ] Run the focused tests, `pnpm test`, and `pnpm build`.

## Task 5: End-to-end demo flow

**Files:** Create `src/app/page.tsx`, `src/app/listings/page.tsx`, and minimal `src/components/*` files.

**Interfaces:** Use only `/api/*` from browser code. Show fixture results until live ingestion has data.

- [ ] Add a manual profile form for budget, beds, move-in date, preferred amenities, lifestyle text, and priority order.
- [ ] Show ranked cards with score details, source freshness, and **Needs verification** labels.
- [ ] Show refresh progress and final counts through TanStack Query.
- [ ] Change priority order in the UI and confirm the visible ranking changes.
- [ ] Run `pnpm test`, `pnpm build`, and a basic desktop/mobile smoke check.

## Integration

- [ ] Review all route authorization and server-only imports.
- [ ] Verify one fixture ranking and one signed Firecrawl callback locally.
- [ ] Compare local migration state with the connected Supabase project before remote application.
- [ ] Add `APP_BASE_URL` after a public Vercel URL exists, then verify webhook delivery.
