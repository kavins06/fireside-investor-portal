# Implementation Plan: Fireside Investor Portal — Phase 1 (MVP)

> Status: **Planning complete — not yet started.** Source of truth for the build.
> Product definition is locked (see `MEMORY.md` / personal memory `fireside-investor-portal.md`).
> Last updated: 2026-06-23.

## Overview

Build a cinematic, prospect-facing showcase of Fireside Strategies' live real-estate deals — a fundraising/marketing instrument (not a transaction system) whose only job is to make a prospective investor *want in*. Phase 1 ships a live URL with: a cinematic portal home, the **Four Seasons Townhomes** deal as an immersive scroll-driven page (hero → property → thesis/market → live returns model), where the story and property are open to all and the **live numbers unlock with an email** (lead captured + GP notified). The existing vanilla-JS finance engine is reused; GSAP 3.15.0 (already vendored) drives the motion.

## Architecture Decisions

- **Astro + GSAP, deployed to Vercel.** Content-driven marketing site that ships minimal JS except where interactivity is needed (the model). Trivial Vercel deploys → a live URL on day one. *(User had no stack preference; chose the recommendation.)*
- **Deals as structured content records** (Astro content collection, one record per deal). "Many deals, frequently updated, but Claude/the skill builds them" → git-based content the skill writes; adding a deal = adding a record. No self-serve admin CMS in Phase 1.
- **Finance engine extracted to one framework-agnostic module** (`engine.js`: `irr`, `run`, waterfall, formatters) and mounted as an interactive island. Single source of truth for the math across every deal; preserves parity with the existing dashboard.
- **Email-unlock is the only real backend.** A small Supabase `leads` table (insert-only RLS) + an edge/serverless function that records the lead and notifies the GP. No per-investor logins, no shared passcode.
- **Imagery = tasteful placeholders now** (Pexels / image-gen), real assets swapped later.
- **Brand fidelity is non-negotiable:** reuse the exact Fireside design tokens (navy/gold/paper, Jost/Inter, F/S mark) from the existing SKILL.md and Four Seasons dashboard.
- **Repo layout:** the portal lives in a new `portal/` directory; the existing standalone dashboard and `GSAP/` are left intact and referenced, not overwritten.

## Dependency Graph

```
Astro scaffold + design system (tokens, fonts, GSAP)   [Task 1]
    │
    ├── Finance engine module (extracted)              [Task 2]
    │        └── Interactive model island              [Task 5]
    │
    ├── Deal content schema + Four Seasons record       [Task 3]
    │        └── Cinematic deal page (hero→property→thesis) [Task 4]
    │                ├── Market Pulse card              [Task 6]
    │                └── Email-unlock gate (UI)         [Task 8]
    │                        └── Supabase leads backend [Task 7]
    │
    ├── Portal home (deal index)                        [Task 9]
    │
    └── Polish: imagery [10] · a11y/footer [11] · prod deploy [12]
```

Build bottom-up. High-risk items (Vercel deploy pipeline, Supabase) are pulled early to fail fast.

---

## Task List

### Phase 1: Foundation

## Task 1: Scaffold Astro project + design system + prove the deploy pipeline

**Description:** Create the `portal/` Astro app, establish the Fireside design system (CSS custom properties for the navy/gold/paper palette, Jost/Inter fonts, the F/S mark component, base layout), wire GSAP from the vendored `GSAP/dist`, and deploy a trivial placeholder page to Vercel to prove the pipeline end-to-end before any real work.

**Acceptance criteria:**
- [ ] `portal/` Astro project runs locally and builds clean
- [ ] Design system tokens + base layout + F/S mark render and match the existing brand exactly
- [ ] A placeholder page is live on a public Vercel URL

**Verification:**
- [ ] Build succeeds: `cd portal && npm run build`
- [ ] Dev server renders: `npm run dev` → base layout on brand
- [ ] Manual check: public Vercel URL loads the placeholder
- [ ] Plugin: 〔Vercel〕 `deploy_to_vercel` + `get_deployment_build_logs` clean

**Dependencies:** None
**Files likely touched:** `portal/package.json`, `portal/astro.config.mjs`, `portal/src/styles/tokens.css`, `portal/src/layouts/Base.astro`, `portal/src/components/Mark.astro`
**Estimated scope:** M
**Skills:** `design:design-system` (formalize tokens/scale/components) → `frontend-design` (foundation quality) · `marketing:brand-review` (brand match)

---

## Task 2: Extract the finance engine into a shared module + parity test

**Description:** Lift `irr()`, `run()`, the LP/GP waterfall, and the formatters out of the existing `index.html` into a single framework-agnostic `engine.js`. Add a test that reproduces the known Four Seasons base-case outputs (deal IRR, multiple, LP/GP splits) to guarantee no math drift from the original dashboard.

**Acceptance criteria:**
- [ ] `engine.js` exports the model functions with no DOM/Chart dependencies
- [ ] A parity test reproduces the original dashboard's base-case figures within rounding
- [ ] No numeric logic was changed during extraction (pure move + module wrap)

**Verification:**
- [ ] Tests pass: `cd portal && npm test -- engine`
- [ ] Manual check: base-case IRR/multiple/LP-GP equal the current `index.html`
- [ ] Skills: `financial-analysis:debug-model` (audit) + `tested-reit-valuation` (sanity-check assumptions)

**Dependencies:** Task 1
**Files likely touched:** `portal/src/lib/engine.js`, `portal/tests/engine.test.js`
**Estimated scope:** S

---

### Checkpoint: Foundation (after Tasks 1–2)
- [ ] App builds clean; placeholder is live on Vercel
- [ ] Design system on brand (`marketing:brand-review` pass)
- [ ] Engine extracted with parity test green
- [ ] **Review with human before proceeding**

---

### Phase 2: Core Features (vertical slices)

## Task 3: Deal content schema + seed the Four Seasons record

**Description:** Define the structured deal record (Astro content collection schema): identity/brand facts, `baseNOI`/`baseOpex` arrays + capital structure for the engine, thesis copy, market notes, and image slots. Seed the Four Seasons record from the existing `DEAL` object and the fund deck.

**Acceptance criteria:**
- [ ] Schema validates a deal record at build time (typed/zod)
- [ ] Four Seasons record holds all data the page + engine need
- [ ] Engine consumes the record and returns the same base case as Task 2

**Verification:**
- [ ] Build succeeds with schema validation on: `npm run build`
- [ ] Manual check: a script/page prints Four Seasons base-case from the record
- [ ] Plugin: 〔Quoin〕 `quoin_property` / `quoin_market` to enrich real property + submarket facts
- [ ] Skill: `marketing:content-creation` for thesis/hero copy (in the user's voice — `voice-principles.md`)

**Dependencies:** Task 2
**Files likely touched:** `portal/src/content/config.ts`, `portal/src/content/deals/four-seasons.md` (or `.json`)
**Estimated scope:** M

---

## Task 4: Cinematic Four Seasons deal page (static sections + GSAP)

**Description:** Build the immersive scroll page from the record: cinematic hero (deal name, location, headline returns), property/location section, and thesis + market section — with GSAP scroll reveals, parallax, and animated counters. The live model slot is present but stubbed (ungated dev placeholder) until Tasks 5/8.

**Acceptance criteria:**
- [ ] Page renders hero → property → thesis/market from the record, on brand and cinematic
- [ ] GSAP reveals/counters fire on scroll; `prefers-reduced-motion` disables them
- [ ] Responsive at mobile/tablet/desktop

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: scroll the page; motion is smooth and reduced-motion-safe
- [ ] Skills: `frontend-design` (the build) · `design:ux-copy` (section microcopy)

**Dependencies:** Task 3
**Files likely touched:** `portal/src/pages/deals/[slug].astro`, `portal/src/components/deal/Hero.astro`, `Property.astro`, `Thesis.astro`, `portal/src/scripts/reveals.js`
**Estimated scope:** M

---

## Task 5: Interactive returns-model island (engine-backed)

**Description:** Mount the live model as an interactive island fed by the deal record + `engine.js`: KPI strip, scenario levers, the charts, the annual cash-flow table, the LP/GP waterfall, and the "Your Investment" check-size scaler. Initially rendered ungated behind a dev flag so it can be validated before the gate exists.

**Acceptance criteria:**
- [ ] Model recomputes live on lever changes; outputs match the original dashboard
- [ ] "Your Investment" scales LP distributions/IRR/multiple correctly
- [ ] Charts + table + waterfall render on brand

**Verification:**
- [ ] Tests pass: `npm test -- engine` (still green via the island's calls)
- [ ] Manual check: move levers; numbers match current `index.html` behavior
- [ ] Skill: `financial-analysis:debug-model` spot-check

**Dependencies:** Task 2, Task 3
**Files likely touched:** `portal/src/components/deal/Model.island.*`, `portal/src/components/deal/charts.js`
**Estimated scope:** M

---

## Task 6: Market Pulse / Risk Flags card

**Description:** Add the dated Market Pulse card (per SKILL.md Section 8): live macro + submarket findings for the deal's market, each tagged supportive / watch / challenges-an-assumption, with sources and a date stamp.

**Acceptance criteria:**
- [ ] Card shows ≥3 dated, tagged findings relevant to the Four Seasons market
- [ ] Each finding cites a source; card is marked illustrative
- [ ] Visually consistent with the card system

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: findings are real and current (not stale training data)
- [ ] Skills: `market-researcher:competitive-analysis` / `comps-analysis`; Plugins: 〔Quoin〕 `quoin_market` + `WebSearch` for live rates/supply

**Dependencies:** Task 4
**Files likely touched:** `portal/src/components/deal/MarketPulse.astro`, deal record (market findings field)
**Estimated scope:** S

---

## Task 7: Supabase leads backend (table + RLS + notify)

**Description:** Stand up the only backend: a Supabase `leads` table (email, deal slug, timestamp, optional name), insert-only Row-Level Security (anon key can insert, cannot read), and an edge/serverless function that records the lead and notifies the GP. **Security-reviewed before wiring to UI.**

**Acceptance criteria:**
- [ ] `leads` table + insert-only RLS deployed; anon key cannot read existing rows
- [ ] Endpoint records a lead and triggers a GP notification
- [ ] No service key is ever exposed client-side

**Verification:**
- [ ] Manual check: insert via anon key works; select via anon key is denied
- [ ] Plugin: 〔Supabase〕 `apply_migration`, `execute_sql`, `get_advisors` (security advisor clean)
- [ ] Skill: **`security-review`** on the policy + endpoint before Task 8

**Dependencies:** Task 1
**Files likely touched:** `portal/supabase/migrations/*.sql`, `portal/src/pages/api/unlock.ts` (or a Supabase edge function)
**Estimated scope:** M  ·  **High-risk — do early**

---

## Task 8: Email-unlock gate (wire UI ↔ backend)

**Description:** Gate the model: teaser headline numbers public; the full interactive model hidden behind an email form. On submit, write the lead (Task 7), then reveal the model. Persist the unlock locally so a returning visitor isn't re-prompted.

**Acceptance criteria:**
- [ ] Model is hidden until a valid email is submitted; teaser numbers remain visible
- [ ] Submitting an email creates a lead row and reveals the model
- [ ] Returning (same browser) stays unlocked; no other content is gated

**Verification:**
- [ ] Manual check: enter an email → a lead lands in Supabase → model appears
- [ ] Negative check: invalid email rejected; gated DOM not present before unlock
- [ ] Skills: `security-review` (no leakage of gated data pre-unlock), `design:ux-copy` (the prompt)

**Dependencies:** Task 5, Task 7
**Files likely touched:** `portal/src/components/deal/UnlockGate.island.*`, `portal/src/components/deal/Model.island.*`
**Estimated scope:** M

---

## Task 9: Portal home (cinematic deal index)

**Description:** Build the landing/home page: a cinematic index of the deal roster (Four Seasons in Phase 1) that links into each deal page, on brand with GSAP entrance motion.

**Acceptance criteria:**
- [ ] Home lists deals from the content collection and links to each page
- [ ] On brand, cinematic, responsive, reduced-motion-safe

**Verification:**
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: home → Four Seasons navigation works
- [ ] Skill: `frontend-design`

**Dependencies:** Task 3
**Files likely touched:** `portal/src/pages/index.astro`, `portal/src/components/home/DealCard.astro`
**Estimated scope:** S

---

### Checkpoint: Core Features (after Tasks 3–9)
- [ ] End-to-end works locally: home → deal page → scroll → email unlock → model + lead lands
- [ ] Engine parity still green
- [ ] `security-review` passed on Tasks 7–8
- [ ] **Review with human before proceeding**

---

### Phase 3: Polish

## Task 10: Placeholder imagery integration

**Description:** Source and integrate tasteful placeholder imagery for the hero and property sections so the page reads as complete; structure assets so real photos swap in later by replacement.

**Acceptance criteria:**
- [ ] Hero + property use high-quality, on-tone placeholder imagery
- [ ] Assets are organized for easy later replacement; layout holds with real aspect ratios

**Verification:**
- [ ] Build succeeds; images optimized (Astro image handling)
- [ ] Manual check: page looks finished, not stock-y
- [ ] Plugins: 〔Pexels〕 `pexels-search-photos`; optionally 〔image-gen〕 `generate_image` / `generate_video` (hero loop)

**Dependencies:** Task 4
**Files likely touched:** `portal/src/assets/deals/four-seasons/*`, deal record image fields
**Estimated scope:** S

---

## Task 11: Accessibility, disclosure footer, and QA pass

**Description:** Add the standard Fireside disclosure footer to all pages and run the quality gates: accessibility (motion, contrast, focus order, keyboard), brand consistency, and a code review of the engine extraction + endpoint.

**Acceptance criteria:**
- [ ] Disclosure footer present on home + deal pages
- [ ] Accessibility issues resolved (reduced motion, AA contrast, keyboard nav)
- [ ] Code review clean on engine + unlock endpoint

**Verification:**
- [ ] Manual check: keyboard-only walkthrough; reduced-motion setting honored
- [ ] Skills: `design:accessibility-review`, `design:design-critique`, `code-review`

**Dependencies:** Task 8, Task 9
**Files likely touched:** `portal/src/components/Footer.astro`, minor fixes across components
**Estimated scope:** S

---

## Task 12: Production deploy + verify (+ optional 2nd deal)

**Description:** Deploy the finished MVP to the live Vercel URL with Supabase wired, and verify the full prospect flow in production. Optionally seed a second deal record to prove the data-driven rendering (no code changes needed).

**Acceptance criteria:**
- [ ] Live URL serves home + Four Seasons with a working email unlock that records leads
- [ ] (Optional) a 2nd deal renders purely from its record
- [ ] Build logs clean; no client-side secrets

**Verification:**
- [ ] Plugin: 〔Vercel〕 `deploy_to_vercel` + `get_deployment_build_logs`
- [ ] Skill: `verify` / `run` — exercise the live flow; confirm a lead lands
- [ ] Manual check: real unlock on the live URL

**Dependencies:** Tasks 8, 9, 11
**Files likely touched:** `portal/astro.config.mjs` (adapter/env), Vercel project settings, optional `portal/src/content/deals/<deal-2>.md`
**Estimated scope:** S

---

### Checkpoint: Complete (after Tasks 10–12)
- [ ] All acceptance criteria met across tasks
- [ ] Live URL demo'd; honest list of what's deferred to Phase 2/3
- [ ] **Ready for review**

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Full MVP vs a single session | High | Thin vertical slice first (Tasks 1–8 for one deal); imagery/2nd deal are Phase-3/optional. Cut line: ship with lead *stored* even if notify isn't wired |
| Supabase + email-notify setup eats time | Med | Task 7 done early and isolated; the gate works with lead stored even if the notification lags |
| Public anon key exposed client-side | High | Insert-only RLS; `leads` not client-readable; `security-review` gate before UI wiring; no service key in the frontend |
| Engine drift during extraction | High | Pure move + parity test (Task 2) before anything renders numbers |
| "Bold cinematic" without real assets | Med | Strong art direction from brand tokens + GSAP motion; quality placeholders; real assets later |
| Gated data leaking pre-unlock (in DOM/network) | Med | Render teaser only; fetch/compute full model client-side after unlock; verify no gated payload before email |
| Skill's "standalone HTML" contract breaks | Low | Intentional; SKILL → pipeline rewrite deferred to Phase 2 (already noted in memory) |

## Open Questions (need human input)

- **GP notification channel** for new leads — email, Slack, or just visible in Supabase for now? (Slack MCP is connected if wanted.)
- **Live URL preference** — fine to ship on a default Vercel subdomain in Phase 1, with a custom domain in Phase 3? (Assumed yes.)
- **Teaser numbers** — which 1–2 figures stay public above the gate (e.g. target IRR + equity multiple), and which are reserved until unlock?
- **Lead fields** — email only, or also capture name / firm to make the lead more useful?

## Parallelization Opportunities

- **Safe to parallelize:** Task 2 (engine) ∥ Task 1's design-system polish; Task 6 (Market Pulse content) ∥ Task 5 (model island); Task 10 (imagery sourcing) can run alongside Phase 2.
- **Must be sequential:** Task 1 → everything; Task 7 (Supabase) before Task 8 (gate); Task 2 before Tasks 5/8.
- **Needs coordination (define contract first):** the **deal record schema (Task 3)** is the shared contract between the page (Task 4), the model (Task 5), and content (Task 6) — lock it before parallelizing those.

## Skill & Plugin Map (quick reference)

| Stage / Tasks | Lead skill(s) | Plugin(s) |
|------|---------------|-----------|
| Grounding (pre) | `pdf`/`markitdown`, `product-management:write-spec`, `marketing:brand-review` | — |
| 1 Scaffold/design | `design:design-system`, `frontend-design` | Vercel |
| 2,5 Numbers | `financial-analysis:debug-model`, `tested-reit-valuation` | — |
| 3,6 Content & market | `marketing:content-creation`, `market-researcher:competitive-analysis`, `design:ux-copy` | Quoin, WebSearch |
| 4,9 Cinematic UI | `frontend-design`, `design:ux-copy` | — |
| 7,8 Gate & data | `security-review` | Supabase |
| 10 Imagery | — | Pexels, image-gen |
| 11,12 QA & ship | `design:accessibility-review`, `design:design-critique`, `code-review`, `verify`, `run` | Vercel |
| Phase 2 pipeline | `skill-creator` / `plugin-dev:skill-development` | Quoin |

## Pre-implementation Verification (gate before coding)

- [ ] Every task has acceptance criteria — yes
- [ ] Every task has a verification step — yes
- [ ] Dependencies identified and ordered (graph above) — yes
- [ ] No task touches more than ~5 files — yes (all S/M)
- [ ] Checkpoints exist between phases — yes (Foundation / Core / Complete)
- [ ] **Human has reviewed and approved this plan** — pending
