# Student Auth and Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students sign in, join one housing group by email invitation, and share one ranking and saved-home list.

**Architecture:** Supabase Auth manages identity. Next.js routes verify the student before accessing private data. Supabase stores memberships, invitations, and group saves. The existing ranker runs once per completed member profile and combines results.

**Tech Stack:** Next.js 16, Supabase Auth, `@supabase/ssr`, Postgres, Zod, TanStack Query, Mantine, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-20-student-auth-groups-design.md`

## Global Constraints

- Preserve existing profile rows; do not serve them without an owner.
- Keep group membership and profile access on authenticated server routes.
- Keep one group per user and one shared ranking per group.
- Keep the shared inbox outside this plan.

## Review Focus

- A forged cookie cannot read another student's profile.
- An invitation cannot be accepted by a different email address.
- A group member cannot read another group's saves or ranking.
- A confirmed firm failure for one member excludes a home.
- An invitation remains pending until the student accepts it or it expires.

---

### Task 1: Identity and profile ownership

**Files:** `src/lib/supabase/auth.ts`, `src/lib/supabase/proxy.ts`, `src/proxy.ts`, `src/app/api/auth/*`, `src/app/api/profiles/route.ts`, `src/lib/supabase/profiles.ts`, `src/components/onboarding/Onboarding.tsx`, `supabase/migrations/*`, `.env.example`, `README.md`.

**Interfaces:** `currentStudent(): Promise<{ id: string; email: string } | null>`; private profile routes require the student ID.

- [ ] Add tests for absent and forged identity and profile ownership.
- [ ] Run tests and confirm failure.
- [ ] Add Supabase Auth password sign-in, sign-up, sign-out, and session refresh.
- [ ] Add a profile owner column and restrict profile reads and writes to the owner.
- [ ] Show sign-in state in onboarding and preserve the public demo preview.
- [ ] Run focused tests, `pnpm test`, and `pnpm typecheck`.

### Task 2: Group membership and pending invitations

**Files:** `supabase/migrations/*`, `src/lib/groups/*`, `src/app/api/groups/*`, `src/app/groups/page.tsx`, `src/components/groups/*`.

**Interfaces:** Create a group, invite an email, list pending invitations, accept an invitation, and read the current group.

- [ ] Add tests for membership, email binding, expiration, duplicate invitations, and pending storage.
- [ ] Run tests and confirm failure.
- [ ] Add tables, server operations, and authenticated routes.
- [ ] Add the group page with create, invite, accept, and member views.
- [ ] Run focused tests, `pnpm test`, and `pnpm typecheck`.

### Task 3: Shared ranking and saved homes

**Files:** `src/lib/matching/*`, `src/app/api/groups/*`, `src/components/onboarding/Results.tsx`, `src/components/onboarding/ListingDetail.tsx`, `src/components/onboarding/MatchesPage.tsx`, `supabase/migrations/*`.

**Interfaces:** A group route returns one ranked list. A save route reads and changes the group's saved listing IDs.

- [ ] Add tests for group score aggregation, firm failures, and empty profiles.
- [ ] Run tests and confirm failure.
- [ ] Add the group ranking and save operations.
- [ ] Connect results and listing detail to group data while preserving visitor behavior.
- [ ] Run focused tests, `pnpm test`, `pnpm typecheck`, and `pnpm build`.

## Completion

Verify two distinct students in one group and a third student outside the group. Check pending invitations for both the creator and invitee. Review the branch for data exposure.
