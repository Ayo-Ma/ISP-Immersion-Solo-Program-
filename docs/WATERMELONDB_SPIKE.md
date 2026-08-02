# WatermelonDB + Supabase Sync Spike — Outcome (Phase 1, Standing Risk #2)

**Date:** 2026-08-02
**Required by:** MVP Dev Roadmap, Phase 1 Gate — *"The sync spike has a documented go/no-go decision"* — before any Phase 9 (Offline Sync) work begins.

## Decision: **Conditional GO**

The specific risk named in CLAUDE.md — *"no official adapter exists"* between WatermelonDB and Supabase — is resolved: a hand-rolled Edge Function implementing WatermelonDB's pull/push sync protocol works correctly against real Postgres, including under RLS. That was the part genuinely in question. It's conditional because the other half of the stack (WatermelonDB's native SQLite layer, actually running on a device) was not exercised in this environment — see "What remains unverified" below.

## What was actually verified (against the real `isp-app-dev` project, not a mock)

A dedicated spike table (`spike_sync_notes`) and Edge Function
(`supabase/functions/watermelon-sync-spike`) were built and deployed, then
driven through the exact wire protocol WatermelonDB's `synchronize()` uses —
see `supabase/tests/watermelon-sync-spike.manual.mjs` for the full script.
All of the following passed for real:

1. **First sync (empty baseline)** — pull with no cursor returns cleanly.
2. **Create propagates** — a pushed new record appears in the next pull's `created` list.
3. **Update propagates correctly, not as a duplicate create** — a pushed edit to an existing record appears in `updated`, and is correctly excluded from `created` because its `created_at` predates the cursor. This is the part that's easy to get subtly wrong in a hand-rolled adapter, and it's confirmed correct.
4. **Deletes propagate as tombstones** — a soft-delete (`deleted_at` set) surfaces as a bare ID in the next pull's `deleted` array, per WatermelonDB's expected contract.
5. **RLS composes correctly with sync** — a second user pulling from scratch never sees the first user's rows. Sync is scoped by RLS, not just by which endpoint was called.
6. **RLS blocks cross-user writes even through the sync push endpoint** — a user attempting to push an update onto another user's record gets a 200 response (the endpoint doesn't error) but the row is silently left unchanged, because the UPDATE policy's row match excludes it. Verified via a direct admin-client read after the attempted attack, not just trusting the HTTP status.

The Edge Function runs with the **caller's JWT**, not `service_role` — so every one of these checks is a genuine test of the production security model, not a privileged bypass.

## What remains unverified

WatermelonDB requires native SQLite modules that don't run in Expo Go and need a custom dev client (EAS Build or `expo prebuild`). This session had no
Docker, no simulator, and no connected device, so the following is written
and typechecked but **not yet run**:

- `apps/mobile/db/schema.ts`, `db/models/SpikeSyncNote.ts`, `db/index.ts` — the local WatermelonDB database setup.
- `apps/mobile/db/sync.ts` — wires WatermelonDB's `synchronize()` to the verified Edge Function.
- The Expo config plugin chain (`@morrowdigital/watermelondb-expo-plugin` + `expo-build-properties`) that makes native builds possible in a managed Expo project.

**Specific compatibility flag:** `@morrowdigital/watermelondb-expo-plugin`'s own README states it's "tested against Expo SDK 49 and 50." This project is on **Expo SDK 57** — seven major versions ahead. The plugin installed without error and `tsc --noEmit` passes clean on all the code that depends on it, but neither of those proves the native build/prebuild step actually works on SDK 57. This is the one real open question standing between "conditional" and "full" go.

## Before Phase 9 fully commits to this architecture

1. Run `npx expo prebuild` (or an EAS development build) and confirm the WatermelonDB native module actually compiles and links on SDK 57 for both iOS and Android.
2. Run the client-side `syncSpikeNotes()` against a real device/simulator and confirm the full loop (local SQLite write → push → pull on a second device → local SQLite read) — not just the server-side half already proven here.
3. Specifically test the "airplane mode → reconnect" scenario that's the actual Phase 9 Gate wording, since that exercises WatermelonDB's local queueing behavior, which this spike didn't touch at all (the spike always had network available).
4. If the Expo plugin turns out to be genuinely broken on SDK 57, the fallback isn't "no offline sync" — it's either (a) a bare/prebuilt workflow instead of managed Expo for the native module, or (b) op-sqlite as the documented Fallback Alternative B (Technical Requirements doc, Section A). Re-spike against whichever fallback before Phase 9, don't assume the original plan still holds.

## Cleanup note

`spike_sync_notes` and `watermelon-sync-spike` are throwaway spike
infrastructure, not part of the production schema (Section A never mentions
either). Drop the table and the function once Phase 9 either commits to this
same design (rebuilding it properly with a real table) or picks the fallback.
