# Google Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace password sign-in with Google while preserving existing accounts.

**Architecture:** Supabase SSR starts Google OAuth and exchanges the callback code. The existing session client handles cookies.

**Tech Stack:** Next.js, Supabase Auth, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-google-sign-in-design.md`

## Global Constraints

- Use pnpm. Keep Google Calendar optional. Do not delete accounts or data.

## Review Focus

- Missing OAuth code returns to sign-in with an error.
- Failed code exchange does not create a session.
- OAuth initiation uses the local callback URL.
- Existing accounts link only through Supabase's verified email behavior.
- Password endpoints no longer accept requests.

---

### Task 1: OAuth routes

**Files:** Create `src/app/api/auth/google/route.ts`, `src/app/api/auth/callback/route.ts`, and route tests.

- [ ] Test OAuth redirect, callback exchange, and failure handling.
- [ ] Run tests and confirm failure.
- [ ] Implement routes with the existing `authClient()`.
- [ ] Run tests and confirm success.

### Task 2: Replace password UI

**Files:** Modify `src/components/onboarding/SignIn.tsx`, `SignIn.module.scss`, `src/app/page.tsx`; remove password routes and tests.

- [ ] Show Google sign-in and callback error.
- [ ] Remove password endpoints.
- [ ] Run typecheck and tests.

### Task 3: Configuration and verification

**Files:** Modify `README.md` and `.env.example`.

- [ ] Document Supabase Google provider and redirect URLs.
- [ ] Run typecheck, tests, and build.
