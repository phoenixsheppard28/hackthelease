# Hack the Lease: Tech Stack and Project Structure

## Scope

This stack is the default for every work section in [`task.md`](../task.md). The first implementation phase covers database and shared types, Firecrawl ingestion, and matching with embeddings.

The app uses one Next.js project. Vercel hosts the app and its server routes. Supabase hosts Postgres.

Use the same framework, UI library, styling system, data layer, and package manager for later sections. Add a service only when a feature requires it. Keep new pages and backend routes in this project.

## Stack

| Area | Choice | Purpose |
| --- | --- | --- |
| Framework | Next.js App Router, React, TypeScript | Serve pages and backend routes from one project. |
| Hosting | Vercel | Deploy the Next.js app and route handlers. |
| UI | Mantine | Provide inputs, cards, tables, dialogs, and status views. |
| Styles | Sass with `.module.scss` files | Style app-specific layouts without Tailwind. |
| Client data | TanStack Query | Fetch rankings and poll active refresh runs. |
| Database | Supabase Postgres with pgvector | Store listings, scrape history, and embeddings. |
| Ingestion | Firecrawl | Run asynchronous crawls and extract structured data. |
| Embeddings | OpenAI `text-embedding-3-small` | Compare listing features with lifestyle preferences. |
| Travel | Google Routes API | Estimate route distance and travel time for confirmed destinations. |
| Validation | Zod | Validate request bodies and scraped records. |
| Package manager | pnpm | Install dependencies and run scripts. |

The OpenAI choice requires an API key. Store all API keys in Vercel environment variables. Do not use `NEXT_PUBLIC_` for Supabase or provider settings.

The browser calls only this app's `/api/*` routes. Route handlers validate requests, check authorization, and call Supabase or external services. No browser code imports a Supabase client or calls its API. Keep provider clients in server-only modules under `src/lib`.

The Supabase project URL and publishable key are public credentials. This project still uses them through server routes. Keep all secret keys on the server.

Mantine supports [Next.js App Router](https://mantine.dev/guides/next/) and [Sass modules](https://mantine.dev/styles/sass/). Kibo UI requires Tailwind, so this project does not use Kibo UI.

## Project structure

Use the optional `src` directory from the [Next.js project structure guide](https://nextjs.org/docs/app/getting-started/project-structure). Keep `src/app` for pages and route handlers. Keep shared code in sibling folders outside `app`.

```text
hackthelease/
├── public/                         # Static images and icons
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout and providers
│   │   ├── providers.tsx           # Mantine and TanStack Query providers
│   │   ├── page.tsx                # Initial demo page
│   │   ├── listings/
│   │   │   └── page.tsx            # Ranked listing view
│   │   └── api/
│   │       ├── refresh/
│   │       │   ├── route.ts        # Start a refresh run
│   │       │   └── [runId]/
│   │       │       └── route.ts    # Read run progress
│   │       ├── firecrawl/
│   │       │   └── webhook/
│   │       │       └── route.ts    # Receive crawl events
│   │       └── rank/
│   │           └── route.ts        # Rank listings for a profile
│   ├── components/                 # Shared Mantine-based UI
│   ├── lib/
│   │   ├── contracts/              # Zod schemas and shared types
│   │   ├── ingestion/              # Source adapters and reconciliation
│   │   ├── matching/               # Firm checks, scoring, explanations
│   │   ├── embeddings/             # Text construction and model client
│   │   └── supabase/               # Server-only clients and generated types
│   └── styles/
│       └── globals.scss            # Global Sass and theme overrides
├── supabase/
│   ├── migrations/                 # Versioned SQL schema
│   └── seed.sql                    # Demo sources and listings
├── docs/
│   └── TECH_STACK.md
├── .env.example                    # Variable names without secrets
├── .gitignore
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

Next.js maps folders under `src/app` to URL segments. A `page.tsx` exposes a page. A `route.ts` exposes an API endpoint. The `[runId]` folder defines a dynamic URL segment. Files under `src/lib` do not define routes.

Create only the folders needed for current work. Add later routes for onboarding, simulation, and outreach when those sections begin. Those sections must follow the same project structure.

## Data and request flow

1. A team user starts a refresh through `POST /api/refresh`.
2. The route creates a database run and starts Firecrawl jobs. It returns the run ID immediately.
3. Firecrawl sends page and completion events to `POST /api/firecrawl/webhook`.
4. The webhook verifies the signature, validates fields, and stores listing observations.
5. Reconciliation updates canonical listings. Changed searchable text receives a new embedding.
6. TanStack Query polls `GET /api/refresh/[runId]` while the run is active.
7. `POST /api/rank` checks firm requirements, scores eligible listings, and returns explanations.

Keep Firecrawl crawls asynchronous. Vercel [limits function duration](https://vercel.com/docs/functions/configuring-functions/duration), so a route must not wait for a full crawl.

Find the webhook signing secret in Firecrawl **Settings → Advanced**. Set `FIRECRAWL_WEBHOOK_SECRET` to that value. Set `APP_BASE_URL` to the deployed app's public HTTPS origin.

## Database tables

| Table | Purpose |
| --- | --- |
| `sources` | Approved housing companies and inventory URLs. |
| `crawl_runs` | Overall refresh status and counts. |
| `crawl_run_sources` | Progress and Firecrawl job ID for each source. |
| `listings` | Canonical housing facts, active status, and one embedding per listing. |
| `listing_observations` | Source URLs, extraction results, evidence, and fetch times. |

Merge records by normalized address and unit only when both values are known. Keep conflicting observations for review. Retain the last successful listings when a source fails.

Mark a source observation stale after two complete, successful refreshes omit it. Keep a canonical listing active while any current source still reports it. A failed or incomplete crawl never removes a listing.

## Matching rules for this phase

Classify each firm requirement as pass, fail, or unknown. Exclude confirmed failures. Mark unknown details **Needs verification**.

Score supported priorities with explicit weights of 50%, 30%, and 20%. Compare lifestyle text with listing embeddings. Return score components and listing facts with each match.

The first ranker supports affordability, preferred amenities, and lifestyle fit. A budget means monthly cost per person, including known recurring fees. Divide unit rent only when the expected roommate count is known. Flag unknown rent basis or fees for verification.

Give missing preference evidence a neutral score of 0.5 and flag it as uncertain. Do not present an unknown amenity as present. Report each score and its evidence so the student can judge the uncertainty.

Section 5 will add travel estimates. Until then, mark commute scoring unavailable and renormalize the weights of supported priorities. Do not present distance as travel time.

## Travel estimates for section 5

Call [Compute Routes](https://developers.google.com/maps/documentation/routes/compute-route-over) from a server route through the shared `estimateTravel` function. Send a listing address and a confirmed destination. Use the student's available travel mode and the relevant departure time. Request only distance and duration fields.

Show distance, estimated duration, mode, and Google Maps attribution with each result. Reuse the estimate in commute scoring and the day simulation. Show modeled delays as separate assumptions.

Keep the API key in `GOOGLE_MAPS_API_KEY`. [Enable Routes API and billing](https://developers.google.com/maps/documentation/routes/get-api-key) in Google Cloud. Set a daily quota before live use. Follow [Google's storage and attribution rules](https://developers.google.com/maps/documentation/routes/policies). Use the documented travel-time matrix when live routing is unavailable.

## References

- [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Mantine with Next.js](https://mantine.dev/guides/next/)
- [Mantine with Sass](https://mantine.dev/styles/sass/)
- [Supabase vector columns](https://supabase.com/docs/guides/ai/vector-columns)
- [Firecrawl crawl API](https://www.firecrawl.dev/crawl)
- [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings)
