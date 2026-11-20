# Session log: core housing work (sections 1, 2, 4)

- **Date:** 2026-11-19, 21:09–22:02 EST
- **Branch:** `codex/core-housing`
- **Plan:** [`2026-11-19-core-housing-implementation.md`](../plans/2026-11-19-core-housing-implementation.md)
- **Spec:** [`2026-11-19-core-data-ingestion-matching-design.md`](../specs/2026-11-19-core-data-ingestion-matching-design.md)
- **Supabase project:** `pxgkjccifnmmqppxvltu`

## Summary

This session completed plan Tasks 1 to 4. Subagents wrote the code. A reviewer checked each task, and fix rounds closed the findings. The database migrations run on the live Supabase project, and live tests passed. A scrape test against the real housing sites found one bug in the extraction schema. That bug is fixed. A decision about the ingestion design is open.

## Setup steps

1. The ponytail skill is installed at `.agents/skills/ponytail/`, and `.claude/skills/ponytail` links to it.
2. Docker was not necessary. The user asked for the migrations to run on the live Supabase project.
3. The Supabase MCP server existed only in the Codex configuration. It was added to Claude Code with `claude mcp add --scope local`.
4. The user restarted Claude Code and signed in through `/mcp`.

## Task results

| Task | Commits | Result |
| --- | --- | --- |
| 1. App foundation and contracts | `437129c` | The review approved it, with 7 minor notes. |
| 2. Database schema and server access | `852c374`..`76b1a03` | One fix round. Applied live and tested. |
| 3. Firecrawl ingestion and refresh status | `92947b7`..`00af567` | One fix round. Applied live and tested. |
| 4. Matching and embeddings | `e4781e0`, `4db1f55` | One fix round. |
| Scrape test fix | `4903fc1` | The extraction schema now works with Firecrawl. |

The tests (82 total) pass, and `pnpm typecheck` and `pnpm build` pass.

## Live database

| Migration version | Contents |
| --- | --- |
| `20261120022614_core_housing_schema` | Tables, pgvector, RLS, RPCs, and grants. |
| `20261120024315_deactivate_stale_listings` | Marks a listing inactive after two successful refreshes omit it. |
| `20261120024328_atomic_listing_observation` | Claims an observation and updates counts in one transaction. |

The seed added 2 sources (Oxford Companies and Cabrio Properties) and 2 demo listings with `is_demo = true`.

The live tests ran inside transactions that rolled back. They confirmed these items:

- The database blocks a second active run for the same source.
- A repeated observation does not cause a write or a count.
- The insert, no-change, and rent-change flags are correct.
- A listing becomes inactive only after two successful runs omit it.
- The `anon` and `authenticated` roles cannot execute the RPCs. RLS is on, and no policies exist.

## Security findings and fixes

| Area | Finding | Fix |
| --- | --- | --- |
| Listing merge | Two sources could overwrite one listing row. | The merge key includes the source ID. |
| New-listing count | Concurrent inserts could count one listing twice. | An insert with `on conflict do nothing`, then a locked update. |
| Refresh authorization | The guard trusted an unconfirmed `email` claim. | Authorization uses the token `sub` and `REFRESH_ALLOWED_USER_IDS`. Anonymous users are rejected. |
| Webhook | Pages with no `json` failed. Hex was not validated. | A placeholder is stored and the page counts as failed. The signature hex is validated strictly. |
| `/api/rank` | Anonymous calls could start bulk listing embedding. | Ranking uses only stored embeddings. Inputs have limits. |
| Embeddings | OpenAI responses were not validated. | The count, indexes, and 1536 dimensions are checked. A timeout applies. |
| Budget check | A rent range above the budget returned `pass`. | A range that goes above the budget returns `unknown` with **Needs verification**. |

## Decisions

- The listing merge key includes the source. A unit listed by two sources shows as two results.
- Ranking does not create listing embeddings. Ingestion creates them.
- `/api/rank` does not require sign-in. It has no rate limit, because an in-memory limit does not hold across Vercel instances.
- Quote style is a deferred minor item. The user's editor changes files to double quotes. A committed Prettier config can settle the style.

## Scrape test

The test called Firecrawl directly and did not write to Supabase.

- Firecrawl `map` found only the start URL for each source. The listing pages load through JavaScript.
- A scrape with `waitFor` found about 60 Oxford property pages under `/apartments/mi/...`. The scrape found about 20 Cabrio unit pages under `/l/...`. Each Cabrio URL occurs three times with different query strings.
- **Bug:** Firecrawl rejected the extraction schema, because the `amenities` field was a dictionary. Every refresh would fail at start. Commit `4903fc1` extracts amenities as a list and changes the list back to a map.
- After the fix, live pages from both sources gave valid listings.
- Firecrawl `extract` with a list schema returned all 20 Cabrio units in one job. The job used 119 credits.

## Decision pending at 22:02 (resolved below)

Should ingestion use Firecrawl `extract` in place of crawl with webhooks?

| | Crawl and webhook (current) | Extract with a prompt |
| --- | --- | --- |
| Listings per page | One | All |
| New sources | Each source needs URL patterns. | One prompt works for all sources. |
| Public `APP_BASE_URL` | Necessary | Not necessary. The status route polls the job. |
| Progress | A count for each page | Running, then the results |
| Evidence | One page for each listing | One source URL for each listing |

The recommendation is to use `extract`. This change goes against the spec, which specifies webhooks.

## Remaining work at 22:02 for sections 1, 2, and 4

### Work for the user

1. Set `APP_BASE_URL` to a public HTTPS URL, unless ingestion changes to `extract`.
2. Set `REFRESH_ALLOWED_USER_IDS`, and make at least one Supabase Auth user for the team.
3. Decide about `public.rls_auto_enable()`. This function existed before the migrations, and `anon` can execute it.
4. Review the 15 new sources in `seed.sql` (auto commit `9b9fdb0`). They are not in the live database.

### Work for the agent

1. Decide between crawl and `extract`, and then do the change.
2. If crawl stays: set `listing_patterns` (Oxford `^/apartments/mi/`, Cabrio `^/l/`) and `ignoreQueryParameters: true`.
3. Make conflicting duplicate amenity names resolve to unknown.
4. Do Task 5: the demo UI with a profile form, ranked cards, **Needs verification** labels, and refresh progress.
5. Run one live refresh from start to end.
6. Do the final review of the full branch.

### Gaps against `task.md`

- Section 1: the `DaySimulation` type and a seeded student schedule are not done. They depend on section 5.
- Section 4: commute is not available until section 5 supplies travel estimates.
- Section 4: required features other than accessibility are preferences, not firm checks.

### Deferred minor items

- Data quality: a source can show an old availability date, and some studios give `beds: null`.
- Extract quality: an address can contain the unit name.
- `/api/rank` has no route-level test, because Vitest has no `@/` alias.
- A crash between steps can make page counts too low, but never too high.
- Firecrawl does not guarantee the order of events.
- The `upsertListing` export has no callers.

## Continuation: 22:03–22:23 EST

The implementation kept Firecrawl crawls and signed webhooks. The Vercel app is live at [Hack the Lease](https://hack-the-lease.vercel.app).

The first Cabrio crawl imported 13 homes outside Ann Arbor. The agent cancelled that crawl and removed only those 13 new listings. The failed run remains in Supabase for audit.

The next crawl used Ann Arbor URL patterns and an address check. It processed 94 pages and added 84 listings. It updated five listings and found two invalid availability values. The run ended as `partial`. A test now covers the values `now` and `null`, and extraction normalizes them. The next live crawl must confirm this fix.

The production home page and ranking route return HTTP 200. The ranking route returned 59 matches with lifestyle scoring available. A forged production webhook returned 401. A signed callback with an unknown run source returned 400. These checks confirm that production uses the webhook secret.

The demo screen now accepts a manual profile, changes priority order, shows the top six matches, and explains scores and uncertain fields. The refresh monitor accepts a team access token and shows run counts. No Supabase Auth users exist yet, so the production refresh route cannot authorize a team member.

The local checks pass: 89 tests, TypeScript, and the production build. Desktop and mobile screenshots show the results screen.

A second, two-page crawl sent real callbacks to the deployed Vercel route. The run succeeded with zero failed pages. The production ranking order changed when the priority order changed. The smoke run exposed an inventory page that Firecrawl treated as one listing. The webhook now blocks inventory pages from listing writes. The two smoke-test listings were removed, and the Cabrio URL pattern was restored.

The user chose to keep production refresh disabled until a team account is ready. The production refresh route returns 401 without a valid allowed user token.

### Remaining work by `task.md` section

| Section | Status and next work |
| --- | --- |
| 1. Database and types | Tables, pgvector, and listing fixtures exist. Add `DaySimulation` and a student schedule with section 5. |
| 2. Ingestion | A live Cabrio run reached `partial`. Retest availability parsing, test Oxford, and add a team user for manual refresh. |
| 3. Onboarding and calendar | The manual profile form exists. Add housing type, car and bus limits, manual schedule entry, and optional Google Calendar import. |
| 4. Matching | Budget, beds, move-in, accessibility, amenities, and lifestyle scores work. Commute scoring waits for section 5. |
| 5. Routing and simulation | Add the travel-time function, fixed-day comparison, and delay scenario. |
| 6. Results and comparison | Ranked cards and refresh status exist. Add side-by-side comparison and a day timeline. |
| 7. AgentMail | Add inquiry drafts, recipient review, and the approved send action. |
