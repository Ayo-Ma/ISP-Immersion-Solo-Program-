# ISP App — Hybrid Design Rulebook
### How to merge Lamborghini's `DESIGN.md` + Linear's `DESIGN.md` into one coherent system

**Read this alongside the two source files, not instead of them.** This document is the reconciliation layer — it tells the agent *which* system governs *which* part of the app, and defines the tokens that replace both sources' native palettes. Where this file is silent, defer to Linear for structure and Lamborghini for restraint.

---

## 1. Visual Theme & Atmosphere

This is a premium, disciplined, professional ministry platform — not a consumer "church app." The bar is excellence and precision, the same bar a fintech or enterprise SaaS product would be held to. Warmth is delivered through *language and interaction tone*, never through soft visuals, pastel color, or decorative religious iconography (no doves, crosses-as-clipart, cursive script, or stock "faith app" visual cliché).

Two source identities, two jobs:
- **Lamborghini** supplies the *brand voice*: black-canvas confidence, gold used sparingly as a signal of significance, monumental type at identity moments, extreme restraint.
- **Linear** supplies the *working voice*: ultra-minimal precision, dense-but-calm data presentation, exacting spacing, zero visual noise in daily-use screens.

The app should feel like a serious tool built by people who take the mission seriously — not a hobby project, not a generic template, not a "spiritual" reskin of a stock UI kit.

---

## 2. The Merge Rule — Which System Governs Which Surface

This is the core instruction. Do not blend the two systems evenly on every screen — assign each screen to one governing system based on its job.

| Surface | Governing System | Why |
|---|---|---|
| Splash / login / onboarding | **Lamborghini** | Identity moment — first impression, brand should dominate |
| Graduation / milestone / achievement screens | **Lamborghini** | Earned, significant moments deserve monumentality and restraint, not a confetti-app treatment |
| Empty states with real weight (e.g. "no disciples assigned yet") | **Lamborghini** | Gravitas over cuteness |
| Daily checklist, module/lesson screens | **Linear** | Daily-use workflow — needs to disappear into function |
| Chat | **Linear** | Functional, high-frequency, must stay out of the way |
| Approval queues (pathway, graduation, checklist review) | **Linear** | Data-dense decision-making — precision over drama |
| Leadership dashboards (Lead Pastor / Supervising Minister) | **Linear** | Structured, scannable, calm under real data volume |
| Forms (registration questionnaire, weekly report) | **Linear** | Input-heavy, needs to be fast and frictionless |
| Navigation chrome (tab bar, headers) | **Linear**, with Lamborghini's gold used only for the active-state indicator | Keeps daily navigation quiet; gold stays meaningful because it's rare |

**Rule of thumb:** if the user is *doing work*, it's Linear. If the user is *arriving* or *has achieved something*, it's Lamborghini. Never let both compete on the same screen.

---

## 3. Color Palette & Roles

Extracted directly from the BBCC logo — do not substitute either source system's native palette.

| Semantic Name | Hex | Role |
|---|---|---|
| `ink-black` | `#0C1014` | Primary dark-mode background. Not pure black — carries a faint slate undertone, softer on screen than `#000000`. |
| `ink-surface` | `#171C22` | Dark-mode card/surface, lifted off `ink-black` for depth without a visible border. |
| `paper-white` | `#FAF8F4` | Primary light-mode background. Warm off-white, not clinical `#FFFFFF`. |
| `paper-surface` | `#FFFFFF` | Light-mode card/surface. |
| `signal-gold` | `#EDBA2A` | The brand accent. Reserved for: primary CTAs, active states, badges, achievement moments, the logo mark itself. Never used as a body background or flooded across a screen. |
| `signal-gold-muted` | `#B8860F` | Gold darkened for light-mode text/icons/small elements — raw `#EDBA2A` fails contrast on white. Dark mode always uses `signal-gold` at full value. |
| `text-primary-dark` | `#F5F5F0` | Primary text on dark surfaces. |
| `text-primary-light` | `#14181D` | Primary text on light surfaces. Softened black, echoes `ink-black` rather than pure `#000000`. |
| `status-complete` | `#6FA37D` (dark) / `#4B6E58` (light) | Functional status color only — "approved," "on track," "graduated." Not a warmth device. Used the way a fintech app uses green: informational, not sentimental. |
| `status-attention` | `#D9714E` (dark) / `#B8552F` (light) | "Needs redo," "overdue," "falling behind." Muted, not alarmist — this app should never look like it's shouting at the user. |

**Gold discipline rule:** if more than ~10% of a screen's visual weight is gold, it's wrong. Gold marks significance; it loses meaning the moment it becomes decorative.

---

## 4. Typography Rules

Revising the earlier serif direction — Fraunces read as "warm ministry," which we've moved away from. This system needs precision, not editorial warmth.

| Role | Typeface | Notes |
|---|---|---|
| Display / Headers | **Space Grotesk** (Bold/Medium) | Geometric, has real character without being a generic AI-default choice. Used at monumental scale only on Lamborghini-governed surfaces. |
| Body / UI | **Inter** | Linear's own typeface. Exceptional legibility at small mobile sizes — non-negotiable for daily-use screens. |
| Numerals / Data | **Inter** (tabular figures enabled) | For scores, dates, counts in dashboards — tabular alignment matters for scannable data tables. |

**Hierarchy discipline:** on Linear-governed screens, type scale stays tight and restrained (Linear's own instinct). On Lamborghini-governed screens, allow one genuinely oversized, monumental headline per screen — never more than one competing for attention.

---

## 5. Component Styling — Merged Rules

- **Buttons:** Linear's precision shape (tight radius, minimal padding, no gratuitous shadow) + Lamborghini's restraint on color — primary action button uses `signal-gold` fill with `text-primary-light` or `ink-black` label text (never white-on-gold, contrast fails). Secondary buttons are outline-only, never gold.
- **Cards:** Linear's flat, bordered/subtle-elevation style. No Lamborghini influence here — cards are workflow surfaces, always governed by Linear.
- **Inputs:** Linear precision — thin borders, clear focus states using `signal-gold` as the focus ring color (this is one of the few places gold appears functionally, not just decoratively, and it's justified because focus state is genuinely significant).
- **Navigation (tab bar):** dark (`ink-black`) regardless of light/dark mode setting — this is a deliberate brand anchor, the one element that stays constant. Active tab indicator in `signal-gold`. Inactive icons in a muted grey, never colored.
- **Badges / Status Pills:** this is where `status-complete` and `status-attention` live — small, precise, Linear-shaped, never oversized or cartoonish.
- **Achievement / Graduation moment:** the one screen allowed real Lamborghini drama — full-bleed `ink-black`, monumental Space Grotesk headline, single gold accent element (e.g. a badge or seal), generous negative space, no clutter.

---

## 6. Layout Principles

- Spacing scale follows Linear's discipline: a consistent 4px base unit (4/8/12/16/24/32/48/64), no arbitrary values.
- Default to generous whitespace on Lamborghini-governed screens; default to efficient density on Linear-governed screens. Both are intentional, not inconsistent.
- Dark mode is the primary, native mode — closest to brand identity. Light mode is a fully-supported alternate, not an afterthought, but every design decision should be made dark-first, then verified in light mode.

---

## 7. Depth & Elevation

- Linear-governed surfaces: near-flat, 1px border separation over shadow wherever possible. If elevation is needed, keep shadows extremely subtle (Linear never uses heavy drop shadows).
- Lamborghini-governed surfaces: depth comes from contrast and scale, not shadow. Avoid skeuomorphic elevation entirely on identity screens.

---

## 8. Do's and Don'ts

**Do:**
- Let gold mean something every time it appears
- Keep daily-use screens fast, quiet, and out of the user's way
- Reserve monumental type and full-bleed black for genuinely significant moments
- Use precise, respectful copy for rejections/overdue states — visual restraint and warm language work together, not warm visuals

**Don't:**
- Don't use both Space Grotesk and gold on the same screen as a workflow screen (checklist, chat, forms) — that combination is reserved for identity moments only
- Don't introduce any religious clip-art, script fonts, pastel colors, or generic "faith app" visual tropes
- Don't let `status-attention` (red-orange) read as harsh or punitive — muted, informational tone only
- Don't default to light mode in design mockups — this brand is dark-first

---

## 9. Agent Prompt Guide — Quick Reference

```
Colors: ink-black #0C1014, ink-surface #171C22, paper-white #FAF8F4,
signal-gold #EDBA2A, signal-gold-muted #B8860F,
status-complete #6FA37D/#4B6E58, status-attention #D9714E/#B8552F

Type: Space Grotesk (display, Lamborghini-governed screens only), Inter (everything else)

Rule: workflow screens = Linear precision, zero gold decoration.
Identity/achievement screens = Lamborghini restraint, one monumental
moment, gold used once and meaningfully. Never mix both on one screen.

Mode: dark-first (ink-black/ink-surface), light mode fully supported
as alternate (paper-white/paper-surface).
```
