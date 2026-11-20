# Calendar Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn frequent recurring Calendar places into reviewed, saved destinations that affect house ranking.

**Architecture:** Fetch expanded primary Calendar events for 120 days and page through results. Group recurring instances by series and location, keep series with at least 20 occurrences, then classify place names and addresses with OpenAI. Let students review the proposals before saving them to their JSONB profile. Add walking routes to approved places and include visit counts in Location scoring.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Google Calendar API, Google Routes API, OpenAI API, Supabase.

**Spec:** `docs/superpowers/specs/2026-11-20-calendar-destinations-design.md`

## Global Constraints

- Use pnpm for scripts.
- Keep raw event descriptions and attendee data out of storage and AI requests.
- Keep manual destinations when Calendar or AI fails.
- Do not add a package or database migration.

## Review Focus

- Google returns several pages: fetch all pages within the request cap.
- One-off events: do not classify them as recurring.
- Changed location in one series: count each location separately.
- Ambiguous address: require student correction before saving.
- Failed route: keep the house visible and mark its Location score incomplete.

---

### Task 1: Fetch and group recurring Calendar places

**Files:** `src/app/api/calendar/route.ts`, `src/app/api/calendar/route.test.ts`, `src/lib/calendar/recurring.ts`, `src/lib/calendar/recurring.test.ts`

**Interfaces:** `frequentRecurringPlaces(events): { location: string; count: number; title: string }[]`.

- [x] Add failing tests for 19 versus 20 instances, separate series and locations, and pagination.
- [x] Run `pnpm test -- src/app/api/calendar/route.test.ts src/lib/calendar/recurring.test.ts`; confirm failure.
- [x] Fetch timed instances within 120 days with `singleEvents=true`, `recurringEventId`, `summary`, `location`, `start`, and `nextPageToken`. Follow all pages within a 40-second deadline. Group and return qualifying places.
- [x] Run the focused tests and confirm success.

### Task 2: Classify and review destinations

**Files:** `src/lib/calendar/classify.ts`, `src/lib/calendar/classify.test.ts`, `src/components/onboarding/Onboarding.tsx`, `src/lib/contracts/housing-profile.ts`, `src/app/api/calendar/route.ts`

**Interfaces:** `classifyPlaces(places): Promise<{ name: string; address: string; count: number }[]>`; `HousingProfile.calendarDestinations` stores approved places.

- [x] Add failing classification and schema tests.
- [x] Run the focused tests and confirm failure.
- [x] Classify grouped places with OpenAI when configured. Keep a manual review fallback. Show counts, editable name and address, and exclude control. Require an address for saved places.
- [x] Run focused tests and confirm success.

### Task 3: Use approved places in Location ranking

**Files:** `src/lib/travel/walking-matrix.ts`, `src/lib/matching/live-ranking.ts`, `src/lib/matching/location-score.ts`, corresponding tests, `README.md`.

- [x] Add failing tests for route destinations, frequency weighted Location score, and incomplete routes.
- [x] Run focused tests and confirm failure.
- [x] Route to approved addresses beside the three manual hubs. Weight approved places by occurrence count while retaining the manual destinations. Update Location notices and README.
- [x] Run `pnpm test`, `pnpm typecheck`, and `pnpm build`; confirm success.
- [x] Review the diff and compare implementation with `task.md` roadmap.
