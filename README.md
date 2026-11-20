# HomeWork

Next.js App Router, React, TypeScript, Mantine, Sass modules, TanStack Query, Zod, and pnpm, following docs/TECH_STACK.md.

## Run

Install with `pnpm install`, then `pnpm dev`. Open http://localhost:8000.
Use `pnpm typecheck` and `pnpm build` to check the application.

## Profiles

Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local. Apply supabase/migrations/20261120060000_housing_profiles.sql in the Supabase SQL editor.

Completed profiles save through /api/profiles. The demo starts with no seeded students. Survey answers stay in React memory until submission. Signed-in students access their own profiles. The survey collects a minimum bedroom count for the whole home; matching filters out known counts below it. It is saved as `profile.bedrooms` in the existing JSONB column, so no migration is required. Older profiles without that answer keep the count inferred from roommates and room sharing.

## Calendar

Google Calendar uses the Supabase Google sign-in provider. Enable the Google Calendar API and the read-only Calendar scope. Add `http://localhost:8000/api/calendar/callback` and `https://tryhomework.vercel.app/api/calendar/callback` to Supabase Auth Redirect URLs. The server keeps a short-lived Google token in an HTTP-only cookie. It reads recurring events for the next 120 days. A place qualifies when one event series visits it at least 20 times. OpenAI suggests place names and addresses for the 20 most frequent places. Students review any additional places manually. Students correct or exclude each place before saving. Students can save up to four Calendar places for ranking. Approved places affect walking scores according to visit frequency. No separate Calendar client ID or secret is needed.

## Frontend

src/components/onboarding owns the survey, icons, question definitions, and Sass module. Aperçu Pro regular and bold are bundled locally. Choice shortcuts A–G, Tab, Enter, previous/next controls, directional transitions, and reduced-motion support are implemented.

The supplied reference uses a 1512 × 945 CSS viewport, a 56px header, 16px outer gutters, a centered 720px question column, and 8px choice gaps. The theme retains the requested Aperçu Pro typeface, smaller type, the supplied reference’s grayscale palette, and Continue without a checkmark.

## Live listing browse and detail pages

`POST /api/matches` now reads active, non-demo rows from Supabase `listings`, joining `listing_images`. Public images come from the existing `listing-images` storage bucket. No database migration is required for this integration. The server uses the existing `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or service role key); credentials and listing vectors are never returned to the browser.

Student sign-in uses Google through Supabase Auth. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Enable Google in Supabase Authentication > Providers and enter the Google OAuth client ID and secret. Add `https://<project-ref>.supabase.co/auth/v1/callback` to the Google client's authorized redirect URIs. In Supabase Authentication > URL Configuration, set Site URL to `https://tryhomework.vercel.app`. Add `http://localhost:8000/api/auth/callback` and `https://tryhomework.vercel.app/api/auth/callback` to Redirect URLs. Supabase links a Google identity to an existing account when Google confirms the same email address. Apply `supabase/migrations/20261120070000_student_groups.sql` to the Supabase project. The connected project received this migration on November 20, 2026.

Students can create one housing group and add an email address to the pending invitations. Tell the invited student to sign in with that Google email. The student sees the invitation after sign-in and can accept it. Group members share a ranking and saved homes; each member keeps a private profile. The group ranking excludes homes that clearly fail any completed member profile and averages the remaining member scores. Existing profiles have no owner and remain stored, but the app no longer shows them.

Sign-in opens homes when a student has a saved profile. New students create a profile first. Housing groups are optional. Students can open group management from homes. The profile button opens profile editing.

The request stays `{ profile, weights }` for the questionnaire. An optional UUID `listingId` loads a single home, including a home that no longer meets the student's requirements. The response is `{ matches, totalListings, notices }`. Cards and details share `ListingMatch` in `src/lib/contracts/listing-match.ts`. Advertised per-unit/per-person rent is preserved; per-person estimates are separately labeled.

The shared `housing.ts` contract, `matching/rank.ts` firm checks and component formulas, and embedding helper were brought in from `origin/main` at `06131a3`. `catalog-matches.ts` maps the questionnaire profile to that contract and applies the four numeric sliders. Confirmed budget and bedroom failures are excluded from the shortlist; unknown bedroom fields stay eligible with internal verification flags; the UI hides homes without listed rent. Home fit currently scores bedroom adequacy, not property type or permitted room occupancy. Individual Location scores use Google walking routes to three selected destinations and approved recurring Calendar places. Group ranking currently excludes Location. Lifestyle uses the existing listing vectors when `OPENAI_API_KEY` is configured; otherwise it is explicitly excluded. Available category weights are renormalized. There is no fixture fallback if Supabase fails.

`/listings-preview` uses a sample student profile against the **live** catalog and never writes a student. Real photos, source links and available `mailto:` / `tel:` actions are wired; day simulation remains unavailable.

Run the adapter checks with `pnpm test:matching`, then `pnpm typecheck` and `pnpm build`.

The existing `POST /api/rank` endpoint retains the recommendations team’s core `HousingProfile` contract. The questionnaire uses `POST /api/matches` for its profile and four slider weights. Firecrawl ingestion, refresh endpoints, and their migrations remain intact.

## Known limitations

Day simulation is not implemented. Location measures walking only, including for students with cars. Calendar frequency affects Location, but event times and transit do not. Home fit only checks bedroom adequacy. Individual slider changes rerank locally; Done saves priorities for signed-in students. Group rankings refresh after priorities are saved. Personal favorites are browser-local; group favorites are shared through Supabase. Calendar access expires after one hour and requires reconnection. Catalog validation currently fails the whole request on a malformed listing.

## Walking routes and location matching

Enable Google **Routes API** with billing and set the server-only `GOOGLE_MAPS_API_KEY` in `.env.local`. No Roads API or database migration is needed. Set a project-wide Google Cloud quota to control costs across server instances; budget alerts alone do not stop spending.

After confirmed budget and bedroom failures, the server requests walking routes to three selected campus destinations and approved Calendar places. `src/lib/travel/destinations.ts` records verified addresses for the campus destinations. Calendar addresses come from student review. Building routes do not guarantee an accessible entrance. Manual driving and transit lookup on the detail page remains separate from matching.

Each destination scores `100 × exp(-walkingMinutes / 30)`. An exceeded walking limit multiplies the score by `limit / walkingMinutes`. Manual destinations have weight one. An approved Calendar place has weight `visits / 20`. Location is the rounded weighted average. This is a convenience heuristic, not a probability. Missing routes produce a null Location score. When Location matters, incomplete routes sort after complete routes and show a partial score.

The individual shortlist and detail share transient TanStack Query evidence. Slider changes only reweight scores in the browser and do not make Google or embedding requests. No Google route results are written to Supabase, localStorage, or sessionStorage. A full reload fetches fresh evidence; inactive queries are discarded after five minutes. Favorites and slider preferences remain separate from route evidence.

Each matrix request has at most 40 origins. The batch size shrinks as students approve more destinations. A browse request allows 250 unique origins. Each batch has two attempts and a 12-second timeout per attempt. Routing has a 45-second deadline. Caller cancellation aborts routing. Quota or authorization errors stop remaining batches. Process-local guards allow two concurrent matrix calls and 1,800 elements per minute. Google Cloud quotas remain necessary. Failed, missing, or capped routes stay visible as incomplete. Walking estimates do not model weather, closures, bus stops, or building access.

Run `pnpm test` for route parsing, batching, failure handling, local reranking and navigation reuse checks alongside the existing suite.
