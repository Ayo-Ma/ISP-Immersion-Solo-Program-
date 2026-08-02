# Phase 0 Setup — What's Scaffolded vs. What You Still Need To Do

This tracks the gap between what Claude Code could scaffold locally and what
requires your own accounts/credentials (per `ISP_App_Full_Development_Process.md`
Part 0–1). None of the account-creation or cloud-provisioning steps below were
done on your behalf — they touch shared/billed systems and need your login.

## Done (local scaffolding)

- Git repo initialized (`main` branch)
- Monorepo layout: `apps/mobile` (Expo/TS), `supabase/migrations`,
  `supabase/functions`, `packages/shared-types`, `packages/logger`
- npm workspaces wired at the root `package.json`
- Strict TypeScript (`tsconfig.base.json`, extended per workspace)
- ESLint (flat config) + Prettier, shared across workspaces
- Husky pre-commit hook running `lint-staged`
- GitHub Actions CI (`.github/workflows/ci.yml`): format check, lint,
  typecheck, test — runs on every PR to `main` and blocks merge on failure
  once branch protection is turned on (see below)
- Sentry wiring, DSN-gated so it no-ops (with a console warning) until you
  provide a real DSN:
  - `apps/mobile/lib/sentry.ts`, initialized in `App.tsx`
  - `supabase/functions/_shared/sentry.ts`, for use in Edge Functions
- Structured logging convention (`{ level, event, userId, context, timestamp }`)
  implemented as `packages/logger` (Node/RN) and its Deno twin
  `supabase/functions/_shared/logger.ts`
- `.env.example` at the root and in `apps/mobile`, documenting every secret
  the app currently expects

## Done since (Phase 1)

- GitHub repo created and pushed (`Ayo-Ma/ISP-Immersion-Solo-Program-`)
- Supabase `isp-app-dev` project (under the ISP team's own Supabase account,
  not a personal one) linked via the CLI; `.env` holds
  `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DEV_PROJECT_REF` /
  `SUPABASE_DEV_URL` / `SUPABASE_DEV_PUBLISHABLE_KEY` /
  `SUPABASE_DEV_SECRET_KEY`
- Full schema (15 tables), RLS policies, and column-ownership guard triggers
  written and pushed to `dev` — see the migrations in `supabase/migrations/`
- Supabase Auth configured: email/password (already on by default) and
  public self-signup disabled (`disable_signup: true`) — roles are
  admin-invited only, verified empirically
- Seed script (`npm run seed`) and RLS test suite (`npm run test:rls`, 40
  tests / 14 suites) — both run against the real `dev` project, not a mock
- WatermelonDB sync spike done — see `docs/WATERMELONDB_SPIKE.md` for the
  go/no-go decision and what still needs a real device to finish verifying

## Still needs you (in order)

1. **Turn on branch protection on `main`** (GitHub → Settings → Branches):
   require the `Lint, typecheck, test` CI check to pass and require a PR
   before merging. Blocked as of this writing — the GitHub account has a
   billing lock preventing Actions from running at all (`github.com/settings/billing`),
   so there's no completed CI run yet to select as a required check.
2. **Expo**: create an Expo account, `npx expo login` from `apps/mobile`.
3. **OneSignal**: create an account/app, drop the App ID into
   `apps/mobile/.env` as `EXPO_PUBLIC_ONESIGNAL_APP_ID` (not wired into code
   yet — that's Phase 8).
4. **Sentry**: create a project (React Native platform for the app; a second
   project or shared project for Edge Functions), then:
   - `apps/mobile/.env`: `EXPO_PUBLIC_SENTRY_DSN=`
   - Supabase: `supabase secrets set SENTRY_DSN_EDGE=<dsn>`
   - Root `.env`: `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` (source
     map upload at build time)
5. **Apple Developer Program / Google Play Console** — per the roadmap these
   can wait until closer to Phase 11, but verification takes time, so start
   the applications early if you want them ready.
6. **Before Phase 9**: run an EAS development build / `expo prebuild` on a
   real device to finish verifying the WatermelonDB spike — see
   `docs/WATERMELONDB_SPIKE.md`'s "Before Phase 9 fully commits" section.

## Not yet decided — flagging, not deciding for you

- CLAUDE.md's file map points at `/docs/instructions.md` and
  `/docs/design/DESIGN.md` + `/docs/design/design.html`, none of which exist
  under those exact paths. The closest real files are
  `docs/ISP_App_Full_Development_Process.md` and, at the repo root of
  `docs/`, `design-approved-snapshot.html` / `prototype-approved-snapshot.html`
  — there's no `docs/design/DESIGN.md` token file yet. This doesn't block
  Phase 0 (design import is explicitly a Phase 3 step per CLAUDE.md), but
  it'll need resolving — either update CLAUDE.md's paths or add the missing
  `docs/design/` files — before Phase 3 starts.
