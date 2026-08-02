# ISP App — MVP Development Roadmap & Execution Checklist

**Role:** Principal Engineer / System Architect build plan
**Scope:** Lean MVP only (per PRD Section D). Full Vision features (AI Assistant, Higgsfield, Marketplace, Community) are explicitly out of scope until this ships and is stable.
**How to use this doc:** Work top to bottom. Each phase has a **Gate** — do not start the next phase until the gate is satisfied. This isn't bureaucracy; it's what prevents building four role-UIs on top of a state machine that's still shifting underneath them.

---

## Phase 0 — Environment & Tooling Setup

- [ ] Initialize monorepo (recommend: `apps/mobile` for Expo app, `supabase/` for migrations + Edge Functions, `packages/shared-types` for Zod schemas shared between frontend and backend)
- [ ] Set up Git repo, branch protection on `main`, PR-required workflow
- [ ] Create three Supabase projects: `dev`, `staging`, `prod` — never share one project across environments
- [ ] Set up secrets management (`.env` per environment, never committed; use Expo's `eas secret` for build-time secrets)
- [ ] CI pipeline (GitHub Actions): lint + typecheck + unit tests run on every PR, blocking merge on failure
- [ ] Configure ESLint + Prettier + strict `tsconfig.json` (`strict: true`, no implicit `any`)
- [ ] Set up error tracking (Sentry or equivalent) wired into both the Expo app and Supabase Edge Functions
- [ ] Set up structured logging convention (consistent log shape: `{ level, event, userId, context, timestamp }`) — agree on this now, not per-developer later

**Gate:** A developer can clone the repo, run the app against `dev`, and a broken PR fails CI automatically.

---

## Phase 1 — Backend Foundation (Schema, RLS, Auth)

- [ ] Write Postgres migrations for all 13 core tables (per Backend System Design doc, Section A)
- [ ] Enforce every status/role field as a Postgres `enum` or `CHECK` constraint — no free text
- [ ] Write RLS policies for every table (per RLS Policy Matrix, Section B)
- [ ] **RLS test suite** — for every table, authenticate as each of the 4 roles and assert exact row visibility (see Risk #1 above). This is a hard gate, not optional.
- [ ] Set up Supabase Auth (email/password to start; magic link optional later)
- [ ] Build role assignment mechanism — how a `users.role` gets set on signup (admin-invited, not self-selected, since roles carry real authority)
- [ ] Seed script: fake Lead Pastor, Supervising Minister, 2 Builders, 6 Disciples, 1 pathway with 3 modules — enough to exercise every flow manually
- [ ] **WatermelonDB + Supabase sync spike** (see Risk #2 above) — one table, full pull/push loop, before committing further. Document the outcome and confirm/reject the offline architecture decision before Phase 9.

**Gate:** All RLS tests pass in CI. The sync spike has a documented go/no-go decision. Seed data loads cleanly in `dev`.

---

## Phase 2 — Core Domain Logic (Edge Functions / State Machines)

Build these server-side, with the state machine rules enforced by the database (triggers/constraints), not just application code — per Backend System Design Section C and E.

- [ ] Pathway request state machine: `requested → under_review → approved/rejected`, requiring both `lp_approved_at` and `sm_approved_at` (parallel)
- [ ] Daily checklist state machine: `draft → submitted → pending_review → approved/needs_redo`, with mandatory rejection reason
- [ ] 48-hour unreviewed-checklist auto-escalation job (Supabase scheduled Edge Function / `pg_cron`)
- [ ] Graduation request state machine: `eligible → builder_recommended → sm_reviewed → lp_approved`, enforced sequentially at the DB level (a CHECK constraint blocking `sm_at` being set while `builder_at` is null)
- [ ] Module progress + clock-in/clock-out logic
- [ ] Test retake logic: rewatch requirement + cooldown timer, 3-failed-attempts → Builder alert
- [ ] Builder capacity soft-cap check (8–12 disciples) — warning, not hard block
- [ ] Builder reassignment action (preserves full history under new Builder)
- [ ] Zod schemas for every Edge Function input/output, shared with frontend via `packages/shared-types`
- [ ] Unit tests for every state transition, including the *invalid* transitions (e.g. confirm `sm_at` genuinely cannot be set before `builder_at`)

**Gate:** Every state machine has passing unit tests for both valid and invalid transitions. Shared types package is published and importable by the frontend.

---

## Phase 3 — Frontend Foundation

- [ ] Expo app scaffold, navigation structure (role-based routing — 4 distinct app experiences from one codebase)
- [ ] Auth flow: login, session persistence, token refresh, logout
- [ ] Design system: color tokens, typography, base components (buttons, cards, status badges) — build once, reuse across all 4 role UIs
- [ ] Global error boundary + user-facing fallback states (no blank screens on failure)
- [ ] Loading/empty/error state patterns established as reusable components before feature screens are built

**Gate:** A logged-in user of any role lands on a role-correct home screen with no feature logic yet — just the shell.

---

## Phase 4 — Disciple Experience

- [ ] Registration questionnaire → pathway suggestion flow
- [ ] "Your pathway request is under review" status screen with expected turnaround
- [ ] Home dashboard (today's lesson, current streak/status)
- [ ] Lesson player (video embed) + notes/downloads
- [ ] Test-taking flow, pass/fail handling, retake flow (rewatch-gated, cooldown-enforced)
- [ ] Daily checklist submission UI with explicit status states (Submitted → Pending Review → Approved/Needs Redo)
- [ ] Growth stage display with visible advancement criteria

**Gate:** A seeded test Disciple can register, get approved (via seeded approval), complete a module, fail and retake a test, and submit a daily checklist end-to-end.

---

## Phase 5 — Builder Experience

- [ ] Dashboard listing assigned disciples with at-a-glance status
- [ ] Checklist review/approve/reject screen, mandatory reason field on reject
- [ ] Graduation recommendation action
- [ ] Weekly check-in "propose 3 times" scheduling flow + manual Google Meet link field
- [ ] Weekly report submission form

**Gate:** A seeded test Builder can review and approve/reject a real submitted checklist, and the correct downstream state change (and notification) fires.

---

## Phase 6 — Supervising Minister & Lead Pastor Experience

- [ ] Pathway approval queue (parallel approval, not sequential)
- [ ] Graduation approval queue (sequential, enforced)
- [ ] Daily digest view (see Phase 8 — this is where the digest actually surfaces)
- [ ] Org-wide reporting dashboard (basic: active disciples, pending approvals, at-risk disciples)
- [ ] Builder reassignment admin action (UI for the Phase 2 backend action)
- [ ] Builder capacity monitoring view

**Gate:** A seeded Lead Pastor and Supervising Minister can each independently approve a pathway request, and graduation only unlocks after all three approvers act in the correct order.

---

## Phase 7 — Chat & Prayer Regimen

- [ ] 1:1 real-time chat (Supabase Realtime), scoped strictly to Builder-Disciple pairs
- [ ] Prayer regimen clock-in/clock-out embedded inside the chat feature
- [ ] Standard in-transit encryption confirmed (full E2E explicitly deferred to Phase 2 of the product, not this build)

**Gate:** Two seeded users (one Builder, one of their Disciples) can exchange messages in real time, and a third seeded user (a different Builder) cannot see that conversation — verified by an automated test, not manual spot-check.

---

## Phase 8 — Notifications

- [ ] OneSignal integration (both platforms)
- [ ] Real-time vs. digest routing logic wired to the `notifications.channel` column
- [ ] Every state transition in Phase 2 fires the correct notification event
- [ ] Daily digest compilation job for Lead Pastor + Supervising Minister
- [ ] Falling-behind detection (3+ days inactive) → disciple reminder + Builder real-time alert

**Gate:** Triggering every event in the Notification Matrix produces the correct notification, to the correct role, on the correct channel (real-time vs. digest) — tested, not assumed.

---

## Phase 9 — Offline Sync (Full Implementation)

*Only proceed here if the Phase 1 spike confirmed the WatermelonDB approach. If the spike failed, this phase becomes "implement Fallback Alternative B" instead.*

- [ ] Full WatermelonDB schema mirroring Supabase schema
- [ ] Pull/push sync Edge Functions for all disciple-facing tables
- [ ] Conflict resolution rule implemented: Builder actions always take precedence over a disciple's offline edits in the same window
- [ ] Pre-download flow for videos/documents ahead of a module
- [ ] "Last synced" indicator visible on Builder/Supervising Minister/Lead Pastor views

**Gate:** A device can go into airplane mode, complete a full daily checklist submission, then reconnect and sync cleanly with no data loss or duplicate records — tested on both iOS and Android.

---

## Phase 10 — Testing & QA

- [ ] Full regression pass across all state machines (valid + invalid transitions)
- [ ] RLS re-verification after all features are built (policies can drift as tables gain new columns/relations)
- [ ] End-to-end test: full disciple journey from registration to one module graduation
- [ ] Load test: notification digest job and checklist-review queries at realistic scale (model at least 500 disciples)
- [ ] Security pass: input validation audit on every Edge Function, dependency vulnerability scan
- [ ] Manual UAT with the Lead Pastor and at least one real Supervising Minister/Builder, using real (not seeded) test accounts

**Gate:** Zero critical/high findings open. UAT sign-off obtained from the Lead Pastor in writing.

---

## Phase 11 — Launch Preparation

- [ ] App Store + Google Play developer accounts set up
- [ ] Privacy policy + Terms of Service pages live (flag: confirm minors policy before this ships if applicable — open item from earlier review)
- [ ] App store listing assets (icon, screenshots, description)
- [ ] Beta group via TestFlight / Play internal testing track
- [ ] Support contact/helpdesk path defined
- [ ] Onboarding one-pagers for Builders and Disciples

**Gate:** Beta build installable by a real, non-technical tester outside the dev team, with no dev intervention required.

---

## Phase 12 — Launch & Post-Launch

- [ ] Production deploy
- [ ] Monitoring/alerting live (error rates, notification delivery failures, Edge Function latency)
- [ ] Feedback collection mechanism in place
- [ ] Two-week post-launch retro scheduled in advance — don't skip this

---

## Explicitly Deferred (Not This Build)

Confirming these stay out per the MVP scope, so no one accidentally builds them mid-phase:
AI Ministry Assistant · AI Content Creation (Higgsfield) · Digital Library beyond module-attached resources · Resource Marketplace · Community Platform · Full end-to-end chat encryption · Native calendar auto-scheduling
