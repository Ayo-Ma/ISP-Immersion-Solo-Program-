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

## Still needs you (in order)

1. **Install dependencies locally**: `npm install` at the repo root.
2. **Create the GitHub repo and push** — this repo has never been pushed
   anywhere:
   ```
   gh repo create isp-app --private --source=. --push
   ```
   or create it manually on github.com and `git remote add origin <url>`.
3. **Turn on branch protection on `main`** (GitHub → Settings → Branches):
   require the `Lint, typecheck, test` CI check to pass and require a PR
   before merging. This is what actually makes Phase 0's Gate — *"a broken
   PR fails CI automatically"* — real; the workflow file alone doesn't
   enforce it.
4. **Supabase**: `supabase login`, then `supabase projects create isp-app-dev`
   and `supabase projects create isp-app-prod`. Per the Full Development
   Process doc, the free tier caps at 2 active projects — `staging` is
   deferred until Phase 10/11, and `dev` absorbs staging-like testing until
   then. Fill `SUPABASE_DEV_PROJECT_REF` / `SUPABASE_PROD_PROJECT_REF` in
   your root `.env`.
5. **Expo**: create an Expo account, `npx expo login` from `apps/mobile`.
6. **OneSignal**: create an account/app, drop the App ID into
   `apps/mobile/.env` as `EXPO_PUBLIC_ONESIGNAL_APP_ID` (not wired into code
   yet — that's Phase 8).
7. **Sentry**: create a project (React Native platform for the app; a second
   project or shared project for Edge Functions), then:
   - `apps/mobile/.env`: `EXPO_PUBLIC_SENTRY_DSN=`
   - Supabase: `supabase secrets set SENTRY_DSN_EDGE=<dsn>`
   - Root `.env`: `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` (source
     map upload at build time)
8. **Apple Developer Program / Google Play Console** — per the roadmap these
   can wait until closer to Phase 11, but verification takes time, so start
   the applications early if you want them ready.

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
