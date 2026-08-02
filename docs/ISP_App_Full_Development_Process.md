# ISP App — Full Development Process
### From Creating the Project to Launch

This is the execution guide that sits above everything else we've built. The **MVP Dev Roadmap** is the detailed phase-by-phase checklist (what to build, in what order, with Gates). This document is the connective tissue around it — the literal setup steps, how to actually work with Claude Code day-to-day, and the full arc from an empty folder to a live app.

---

## Part 0 — Accounts & Tools to Have Ready Before Day 1

**Accounts to create (do this before opening Claude Code):**
- [ ] GitHub account (repo hosting)
- [ ] Supabase account (Free tier caps at 2 active projects — see note below)
- [ ] Expo account (for EAS Build)
- [ ] OneSignal account (push notifications)
- [ ] Apple Developer Program ($99/yr) — can wait until closer to Phase 11, but the account itself takes time to verify, so start early
- [ ] Google Play Console ($25 one-time) — same note as above
- [ ] Anthropic Console account — only needed once you're near Phase 2 of the Full Vision (AI Assistant), not required for MVP

**Local tools to install:**
- [ ] Node.js (LTS version) + npm
- [ ] Git
- [ ] VS Code
- [ ] Claude Code extension (search "Claude Code" in VS Code's Extensions marketplace)
- [ ] Expo CLI: `npm install -g expo-cli` (or use `npx expo` per-project, which is now the more common pattern)
- [ ] Supabase CLI: `npm install -g supabase`

---

## Part 1 — Creating the Project (Literal Steps)

```bash
# 1. Create and enter the project folder
mkdir isp-app && cd isp-app

# 2. Initialize git
git init
git branch -M main

# 3. Create the monorepo structure
mkdir -p apps/mobile supabase/migrations supabase/functions packages/shared-types docs/design

# 4. Create a root .gitignore (node_modules, .env, build artifacts)
echo "node_modules/
.env
.env.local
.expo/
dist/
*.log" > .gitignore

# 5. Create the GitHub repo and push
# (via GitHub's website or the gh CLI: gh repo create isp-app --private --source=. --push)
```

**Drop these files into `/docs`:**
- `ISP_App_PRD_Roles_and_MVP.docx`
- `ISP_App_Backend_System_Design.docx` (the amended version with Section F)
- `ISP_App_Technical_Requirements_and_Pricing.docx`
- `ISP_App_MVP_Dev_Roadmap.md`
- `ISP_App_Context_Handoff_Document.md`

**Drop these into `/docs/design`:**
- `DESIGN.md` (the ground-truth token file extracted from the prototype)
- `ISP_App_Hybrid_Design_Rulebook.md`
- `ISP_Mobile_Prototype_-_Standalone.html`

**Set up Supabase:**
```bash
supabase login
supabase projects create isp-app-dev
supabase projects create isp-app-prod
# Note: Free tier caps at 2 active projects total. Skip a separate
# 'staging' project until Phase 10 (QA)/Phase 11 (Launch Prep), or until
# upgrading to Pro ($25/mo) — whichever comes first. Free projects also
# auto-pause after 7 days of inactivity; resuming a paused project is
# normal, not a bug.
```
Never share one project across environments — this was flagged as a Phase 0 requirement in the roadmap for a real reason: a bad migration or test data run in a shared project is how staging data ends up in front of real users. With only 2 free projects available, that means `dev` absorbs staging-like testing for now — treat any test on `dev` that touches "real-feeling" data with the same care you'd give staging, since it's temporarily doing both jobs.

**Set up secrets:**
- Create `.env` (gitignored) in `apps/mobile` with your dev Supabase URL/anon key
- Use `eas secret:create` for anything that needs to exist at build time rather than runtime

---

## Part 2 — Open in Claude Code and Establish the Persona

Open the `isp-app` folder in VS Code with the Claude Code extension active. Before Phase 0 work starts, create a `CLAUDE.md` file in the repo root — Claude Code reads this automatically at the start of every session, so the operating rules persist without you re-pasting them each time.

**`CLAUDE.md` contents:**

```markdown
# ISP App — Claude Code Operating Rules

You are acting as a Principal Software Engineer / System Architect with 15+
years of production experience in mission-critical applications. Build to
commercial, enterprise-grade standards. You are not a "yes-man" — your job
is to guard this codebase against technical debt, security flaws,
performance bottlenecks, and silent failures.

## Mandatory Pushback
Before writing code for any requested feature, evaluate critically: will
this fail under real-world edge cases or load? Are there hidden security
risks, race conditions, or data leakage vulnerabilities? Is there a
simpler, more maintainable pattern? If an idea is flawed: stop, state
"⚠️ RISK DETECTED", explain why, present 2 battle-tested alternatives,
wait for confirmation.

## Production-Ready Code Standards (No Exceptions)
- No placeholders — `// TODO` or stubbed logic is not acceptable. Write
  every line of required code.
- Defensive error handling on every async call, external API, DB
  transaction, and user input — try/catch, structured logging, user-facing
  fallback states.
- Strict TypeScript, no implicit `any`. Validate all payload boundaries
  with Zod before processing.
- Security by default: RBAC/RLS enforced at the data layer, sanitized
  inputs, proper secret management, auth checks on every protected route.

## Architectural Sanity
Strict modularity (UI / business logic / data access separated).
Predictable, immutable state where appropriate. Schemas properly indexed,
normalized, constrained.

## Two Standing Risks (already accepted, don't re-litigate from scratch)
1. RLS policies must be tested automatically as each table ships — not
   deferred to end-of-project QA.
2. The WatermelonDB/Supabase sync integration needs its Phase 1 spike
   completed and a documented go/no-go before Phase 9 work begins.

## Collaboration Workflow (per component/feature)
1. High-level technical strategy (1-2 sentences)
2. Tradeoffs / key assumptions
3. Clean, production-ready code with inline documentation for complex logic
4. What needs to be tested to guarantee it won't break

## Project Context
Read everything in /docs and /docs/design before starting. The PRD's
Section F and the Backend System Design's Section F contain fixes already
integrated — don't re-derive decisions that are already locked in. The
MVP Dev Roadmap (/docs/ISP_App_MVP_Dev_Roadmap.md) is the phase-by-phase
build plan with Gates — do not start a phase until the prior Gate is
satisfied.
```

**First message to send in Claude Code, once the above is in place:**
> Read everything in /docs and /docs/design. Confirm your understanding of the project, the current phase (Phase 0), and the two standing risks before writing any code.

---

## Part 3 — The 13 Development Phases (Summary)

Full checklists and Gates for each phase live in `ISP_App_MVP_Dev_Roadmap.md` — this table is a map, not a replacement for it.

| Phase | Objective | Gate Before Moving On |
|---|---|---|
| 0 — Environment & Tooling | Repo, CI, secrets, lint/typecheck config | Broken PR fails CI automatically |
| 1 — Backend Foundation | Schema, RLS, Auth, WatermelonDB spike | All RLS tests pass; sync spike has a go/no-go decision |
| 2 — Core Domain Logic | State machines as Edge Functions, shared Zod types | Every state transition has passing tests, valid and invalid |
| 3 — Frontend Foundation | Navigation shell, design system components, auth flow | Logged-in user lands on a role-correct empty shell |
| 4 — Disciple Experience | Registration → lesson → test → checklist, end to end | Seeded Disciple completes the full loop manually |
| 5 — Builder Experience | Roster, checklist review, check-in scheduling | Seeded Builder approves/rejects a real checklist correctly |
| 6 — Leadership Experience | Approval queues, org dashboard | LP + SM can each approve independently; graduation respects order |
| 7 — Chat & Prayer Regimen | Realtime 1:1 chat, scoped correctly | A third party genuinely cannot see a private conversation |
| 8 — Notifications | OneSignal, real-time/digest split | Every Notification Matrix event fires correctly, tested not assumed |
| 9 — Offline Sync | Full WatermelonDB implementation (or fallback) | Airplane-mode checklist submission syncs cleanly on reconnect |
| 10 — Testing & QA | Full regression, RLS re-verification, load test | Zero critical/high findings; Lead Pastor UAT sign-off in writing |
| 11 — Launch Prep | App store accounts, listings, beta group | Non-technical tester installs the beta with no dev help |
| 12 — Launch & Post-Launch | Production deploy, monitoring, retro | Retro scheduled before launch day, not after |

---

## Part 4 — Working With Claude Code Day-to-Day

- **Start each session** by referencing the current phase explicitly: *"We're in Phase 3. Here's today's task: [specific item from the roadmap checklist]."* Don't let sessions drift into future phases without hitting the current phase's Gate first.
- **When Claude Code proposes something that skips a Gate** (e.g., building a frontend screen before its backing state machine has passing tests), that's worth pushing back on directly — the Gates exist specifically to prevent rework.
- **Update the roadmap checklist as you go** — check off items directly in `ISP_App_MVP_Dev_Roadmap.md` and commit that alongside the code, so the doc stays a living source of truth instead of drifting out of date.
- **If a design token or component is needed that isn't in `DESIGN.md`**, stop and add it to that file deliberately rather than letting Claude Code invent one inline — the whole point of extracting it from the real prototype was to keep one accurate source.

---

## Part 5 — Launch Sequence (Recap of Phases 11–12)

1. Beta build via TestFlight (iOS) / Internal Testing track (Google Play)
2. Non-technical tester install, zero dev intervention — this is the actual Gate, not just "it builds"
3. Manual UAT with the Lead Pastor and at least one real Supervising Minister/Builder using real accounts, not seed data
4. Written UAT sign-off from the Lead Pastor
5. Production deploy
6. Monitoring/alerting live before real users touch it, not added after
7. Two-week post-launch retro — scheduled in advance, on the calendar before launch day arrives

---

## Part 6 — After MVP Ships

Do not start Full Vision features (AI Assistant, Higgsfield, Digital Library, Marketplace, Community Platform) until:
- MVP has been live and stable for a defined stretch (recommend at least the two-week post-launch retro has happened and come back clean)
- The open items still sitting in the PRD (Content/Curriculum Admin ownership, Higgsfield POC appetite, approval SLA confirmation, growth-stage criteria, Builder capacity cap number) have actual answers, not defaults we assumed to keep moving
