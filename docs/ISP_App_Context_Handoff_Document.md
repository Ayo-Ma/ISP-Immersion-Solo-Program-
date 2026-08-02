# ISP App — Context Handoff Document
### For migration from personal Claude account to BBCC's Claude Pro account

**How to use this doc:** Upload this file, plus every file listed in Section 3, to the new Project's knowledge base. Then use the "Recommended First Message" in Section 7 to kick off the first conversation there. This document exists because conversation history and memory do not transfer between accounts — everything you need to pick up cold is written down here.

---

## 1. What This Project Is

The **ISP App** (Immersion Solo Program — also referred to early on as "Personal Immersion") is a discipleship management mobile app being built for **BBCC** (the church — logo colors extracted and locked in as the brand palette). It digitizes a currently one-on-one, non-congregational discipleship training program covering finance, purity, spiritual growth foundations, health, and other tracks.

It is modeled loosely on Coursera-style learning combined with a personal accountability relationship between a "Builder" (discipler) and their "Disciple," with a three-tier leadership oversight structure above that relationship.

---

## 2. Key Decisions Locked In

**Roles (four, formally named):**
- **Lead Pastor** (Super Admin) — final approval authority, full visibility
- **Supervising Minister** (Discipleship Unit Head) — co-approves pathway assignment, second-step graduation approval, oversees all Builders
- **Builder** (this ministry's term for "Discipler") — direct 1:1 discipler, daily checklist approval, weekly check-ins
- **Disciple** — the member being trained
- A fifth role, **Content/Curriculum Admin**, was recommended but not yet confirmed as a real assignment — still an open item (see Section 6)

**Core accountability loop (the heart of the app — do not let this get diluted in scope discussions):**
Registration questionnaire → pathway suggested → Lead Pastor + Supervising Minister approve (parallel, not sequential) → daily lessons (video + notes) → end-of-module test (65% pass mark, retake requires rewatch + cooldown) → daily checklist (class/test/prayer regimen) self-reported by Disciple, confirmed by Builder → weekly video check-in (Google Meet) → graduation via three-step chain (Builder → Supervising Minister → Lead Pastor, sequential, DB-enforced) → growth stage advancement (New Believer → Growing Believer → Worker → Leader → Minister, criteria still need explicit definition).

**Tech stack (final, reasoned against cost/scale/reliability priorities):**
- **Frontend:** React Native + Expo (cross-platform, single codebase)
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) — chosen over Firebase specifically because: (1) free tier covers 50K MAU vs. Firebase's unpredictable per-op billing, (2) Postgres + Row-Level Security fits the relational approval-chain data better than Firestore's document model
- **Offline sync:** WatermelonDB (or op-sqlite) syncing against Supabase — flagged as the single highest technical-risk item in the build (no official adapter exists); a dedicated spike is mandated in Phase 1 of the dev roadmap before any UI work proceeds
- **Push notifications:** OneSignal
- **Video:** YouTube/Vimeo embeds (not self-hosted)
- **Weekly check-ins:** Google Meet, manual link-sharing + in-app "propose 3 times" flow at MVP (no calendar API integration yet)
- **AI Ministry Assistant + AI video creation (Higgsfield):** explicitly Phase 2+, not MVP

**MVP scope:** everything in the core loop above, plus basic offline download/sync and notification digest logic. Explicitly excluded from MVP: AI assistant, Higgsfield, Digital Library, Marketplace, Community Platform, full end-to-end chat encryption, native calendar integration.

**Design system:**
- Brand colors extracted directly from the BBCC logo: `ink-black #0C1014`, `signal-gold #EDBA2A`, white. Full token system (including light-mode variants and functional status colors) is in the Hybrid Design Rulebook file.
- Direction is explicitly **premium/disciplined/professional** — not a "soft church app." This was a deliberate correction mid-project; don't default back to warm/pastoral visual instincts.
- Hybrid reference system: **Lamborghini's** DESIGN.md pattern (black-canvas, restrained gold, monumental type) governs identity/achievement moments; **Linear's** DESIGN.md pattern (ultra-minimal precision) governs daily workflow screens (checklist, chat, approvals, dashboards). The two never mix on the same screen — see the Rulebook for the full merge logic.
- Typography: Space Grotesk (display, identity screens only) + Inter (everything else).
- Dark mode is the primary/native mode; light mode is a fully supported alternate.
- **As of this handoff, the user has already set up their own working design system based on this direction** and was about to move into building a clickable prototype in Claude Design, targeting React Native/Expo output.

**Development execution:** actual coding happens in **Claude Code (VS Code)**, not in claude.ai chat — the chat/Project environment isn't suited to a persistent multi-session codebase. A `CLAUDE.md` file in the repo root is the recommended way to persist the Principal Engineer operating rules (Section 4) across every Claude Code session automatically.

---

## 3. Documents Already Produced (Knowledge Base Contents)

Upload all of these to the new Project:

| File | Contents |
|---|---|
| `ISP_App_PRD_Roles_and_MVP.docx` | The core PRD — unique roles, notification matrix, full-vision PRD, lean MVP PRD, **and a Section F Risk & Gap Analysis** with 19 fixes already integrated (structural loopholes, operational pitfalls, user-end discrepancies) |
| `ISP_App_Backend_System_Design.docx` | Database schema (13 core tables), Row-Level Security policy matrix, state machines for the three approval flows, indexing plan, guardrails |
| `ISP_App_Technical_Requirements_and_Pricing.docx` | Full tool stack with current pricing, MVP vs. Full Vision cost estimates, the Supabase-over-Firebase decision writeup |
| `ISP_App_MVP_Dev_Roadmap.md` | 13-phase (0–12) execution checklist with hard Gates between phases — this is the actual build plan to follow in Claude Code |
| `ISP_App_Hybrid_Design_Rulebook.md` | The Lamborghini + Linear merge rules, full color token table, typography, component rules, do's and don'ts |
| `Personal_Immersion_App_Vision_Review.docx` | Early-stage vision document written for the Lead Pastor's review — largely superseded by the PRD but useful for historical context on how the vision was first articulated |
| `Disciple-Path-Project-Checklist.md` | An early, generic full-project-lifecycle checklist (discovery through post-launch) — useful as a reference but the MVP Dev Roadmap is the operative one now |

**Note:** the original `ISP_App_Disciple_Journey.pptx` slide deck was explicitly rejected by the team as insufficiently structured/extensive — a replacement prompt (`Claude_Design_Prompt_ISP_Journey_Deck.md`) was written for Claude Design to regenerate it more thoroughly. Confirm whether that regeneration ever happened before assuming a journey deck exists.

---

## 4. Operating Rules To Re-Establish

The following persona was adopted partway through this project and should be pasted into the **new Project's custom instructions** (not just a chat message) so it persists automatically:

> Acting as a Principal Software Engineer / System Architect with 15+ years of production experience. Mandatory pushback on fragile ideas (flag with "⚠️ RISK DETECTED", explain the failure mode, offer 2 alternatives, wait for confirmation). No placeholder code, ever — complete implementations only. Defensive error handling on every async/API/DB boundary. Strict typing + input validation (Zod) at every payload boundary. Security by default — RLS/RBAC enforced at the data layer. Strict modularity (UI / business logic / data access separated). Per-component workflow: strategy → tradeoffs/assumptions → production code → what needs testing.

Two real risks were already flagged under this persona and are baked into the MVP Dev Roadmap's Phase 1 — don't let a fresh instance re-litigate these from scratch:
1. RLS policies must be tested automatically as each table ships, not deferred to end-of-project QA.
2. The WatermelonDB/Supabase sync integration needs a dedicated technical spike before any UI work — no official adapter exists between the two.

---

## 5. Where We Left Off

- The MVP Dev Roadmap (13 phases) exists but **Phase 0 has not been started yet**.
- Design system work has moved ahead of dev — the user has already built out their own design system based on the Hybrid Rulebook direction and BBCC brand colors.
- Next immediate step (in progress at time of handoff): compiling a master prompt for **Claude Design** to build a clickable React Native-targeted prototype, merging the user journey, the Hybrid Design Rulebook, and the BBCC palette into one spec.

---

## 6. Open Items Still Needing Pastor/Leadership Answers

Carried forward from the PRD and never explicitly closed out:

- Whether any disciples on the platform are minors — affects privacy/consent requirements and has been flagged multiple times without a confirmed answer
- Who owns the Content/Curriculum Admin responsibilities (the Lead Pastor directly, or a delegate)
- Appetite/timing for the Higgsfield AI-video proof-of-concept
- Whether MVP can launch with standard (not end-to-end) chat encryption
- Expected Builder/Disciple count at launch, to size Supabase correctly
- Internal approval SLA (recommended 48–72 hours) and who the backup approver is if the Lead Pastor or Supervising Minister is unreachable
- Builder disciple-capacity soft cap number (recommended 8–12) and whether it should ever hard-block rather than just warn
- Explicit growth-stage advancement criteria (currently undefined from the disciple's point of view)

---

## 7. Recommended First Message for the New Project

Paste this as the first message once the files above are uploaded:

```
You're picking up the ISP App project for BBCC church — a discipleship management
mobile app. Read the uploaded context handoff document first, then the PRD, Backend
System Design, MVP Dev Roadmap, and Hybrid Design Rulebook. Adopt the Principal
Engineer operating rules from the handoff doc's Section 4 as your standing approach
for the rest of this project. Once you've reviewed everything, confirm your
understanding of where we left off and what the immediate next step is — don't
re-derive decisions that are already locked in.
```
