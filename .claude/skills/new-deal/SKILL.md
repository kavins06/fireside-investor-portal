---
name: new-deal
description: >
  Publish a real-estate deal into the live Fireside Investor Portal — the GP's
  hands-off way to add or update a deal by talking to Claude instead of editing
  code. Trigger whenever the user (the GP) wants to add, create, publish, or
  update a deal/property/offering ON THE PORTAL, says "new deal", "add a deal",
  "put this deal on the site", "publish the portal", uploads a pro forma / OM /
  T-12 / rent roll / deck and asks to get it live, or asks to edit an existing
  portal deal. Produces a structured deal record (JSON) the portal renders, wires
  up imagery, validates the numbers against the real engine, and ships it via git
  so Vercel redeploys automatically. This is the deal-publishing pipeline; the
  separate "Fireside Investor Dashboard — SKILL.md" builds a one-off standalone
  HTML dashboard instead — use THIS skill when the destination is the live portal.
version: 1.0.0
last_updated: 2026-06-25
---

# Add a Deal to the Fireside Portal

You are the GP's publishing engine for the **Fireside Investor Portal** (the Astro
site under `portal/`). The GP describes a deal — anything from a full closing pro
forma to three sentences — and you turn it into a live, on-brand deal page on the
portal, end to end, without the GP touching code or git.

The portal renders deals from structured JSON records in
`portal/src/content/deals/<slug>.json`. Your job is to author that record (plus
its imagery and market findings) correctly, prove the numbers are sound, and push
it so Vercel redeploys. **You do not design or style anything** — the portal's
components own all visuals. The record is pure data; get the data right.

> **Brain vs. target.** Apply all the institutional CRE judgment, metric
> definitions, house defaults, and the live market-scan methodology from
> **`Fireside Investor Dashboard — SKILL.md`** (repo root) — Sections 3, 4, 7, 8.
> That skill targets a standalone HTML file; THIS skill targets the portal record.
> Same underwriting brain, different output. Don't duplicate the math here — reuse it.

> **Two ways deals reach the portal.** This skill is the *Claude Code* path (you, in
> the repo: author → validate → git commit → Vercel deploys). Non-technical people
> publish from **Claude Cowork** via the **Fireside Publish connector** (an MCP server
> at `portal/src/pages/api/mcp.ts` → commits to the repo the same way). Both paths run
> the *same* validation (`portal/src/lib/deal-validation.mjs`, shared with the content
> schema) so neither can publish a broken deal. Cowork setup: `portal/docs/cowork-publish-setup.md`;
> go-live: `portal/docs/portal-publishing-provisioning.md`.

---

## Operating protocol (run every time)

1. **Read memory first.** Read `MEMORY.md` and the `## Memory log` in
   `Fireside Investor Dashboard — SKILL.md`. Silently apply preferred defaults,
   recurring co-GPs, naming, structure overrides. Don't announce what you found.
2. **Intake the deal.** Pull every fact the GP gave — chat, an uploaded pro forma /
   OM / T-12 / rent roll / deck, or an existing deal record/HTML to update. Never
   block on missing data.
3. **Fill gaps with flagged house defaults** (dashboard SKILL §4: 90/10 split, 8%
   pref, 20% promote, 2.5× super-promote hurdle, 1% AM fee, 1% sale cost, 7-yr
   hold, agency IO ~5.25% at 65–70% LTV, 95% occ, ~2.5–3% rent growth, ~2.8%
   expense growth baked into the base arrays). Build a complete model from sparse
   input; track which values you assumed.
4. **Run the live market scan** (dashboard SKILL §8) for the deal's specific
   market → produce 3–5 `marketFindings`, each tagged `supportive`/`watch`/
   `challenge`, dated, with a real source. Use web search / research tools — never
   stale training data for rates, supply, or rent trends. **Anchor to today's date
   first:** note today's actual date, then find the *most recent* available stats
   (work backwards from today to the closest real data) — never default to an old
   "as of" period. Set `marketAsOf` to the latest reporting period you found data for
   and `marketLabel` to the submarket name; date-stamp each finding to its real period.
   **Do this as genuine deep research, not one search** (dashboard SKILL §8 "Go deep"):
   triangulate every figure across multiple current, authoritative sources; verify the
   deal's externally-checkable facts; and if you can't verify a number to a credible
   source, leave it out rather than guess. Verified-and-accurate beats long.
5. **Author the record** `portal/src/content/deals/<slug>.json` to the contract
   below. Derive the `teaser` headline numbers from the engine so they don't lie.
6. **Wire imagery** (§ Images). Real photos if the GP provides them; otherwise
   tasteful sourced placeholders with a credit line.
7. **Validate** (§ Validate) — schema (`npm run build`), engine soundness
   (`npm run validate-deal -- <slug>`), and parity (`npm test`). All green before shipping.
8. **Ship** (§ Ship) — `git add` the record + images, commit, push. Vercel
   redeploys; confirm the deal is live.
9. **Summarize assumptions.** List — briefly — every value you assumed vs. were
   given, and offer to refine. This is the GP's safety net.
10. **Learn** — record durable preferences/corrections to memory (§ Memory).

Only ask a question when a missing input would materially mislead (e.g. no price
AND no equity AND no NOI at all). Otherwise build with flagged defaults and go.

---

## The deal record — exact field contract

Authoritative schema: `portal/src/content/config.ts` (Astro validates against it
at build; a violation fails the build). Use `four-seasons.json` as the worked
reference. Required unless marked optional.

```jsonc
{
  "name":   "Four Seasons Townhomes",        // display name
  "slug":   "four-seasons",                  // kebab-case; = filename and /deals/<slug> URL; unique
  "status": "active",                        // "active" | "fundraising" | "closed"  (see § Status)

  "location": {                              // all required
    "city": "Greensboro", "state": "NC",
    "address": "2705 Four Seasons Blvd", "zip": "27407",
    "display": "Greensboro, North Carolina"  // the human label shown on hero/model
  },

  "property": {
    "type": "Multifamily Value-Add",         // required — also the home-list category
    "units": 90,                             // required (number)
    "yearBuilt": 1970,                       // required (number)
    "unitMix": "2BR / 1.5BA",                // optional
    "buildings": 13, "acres": 6.78,          // optional (numbers)
    "sqftPerUnit": 960,                      // optional (number)
    "occupancy": "100%",                     // optional (string, e.g. "100%")
    "coGP": "Ginkgo Residential"             // optional
  },

  "transaction": {                           // all required (numbers, whole dollars)
    "purchasePrice": 9721995, "totalEquity": 4813998,
    "agencyDebt": 6800000, "capImprovements": 1420000
  },

  "engine": { /* see § Engine contract — drives the live model, every value required */ },

  "copy": {
    "tagline": "…",        // required — 1–2 sentences; hero subhead + meta description
    "thesis":  "…",        // required — the "Why we bought it" paragraph (3–6 sentences)
    "marketNotes": "…"     // optional — "The demand story" paragraph
  },

  "teaser": {                                // required — the gated headline figures
    "targetIRR": "~21%",                     // string; DERIVE from the model (LP IRR), don't guess
    "equityMultiple": "~3.2×",               // string; DERIVE from the model
    "holdYears": 7                           // number (display copy; see § Engine note on hold)
  },

  "images": {                                // optional block, but supply hero+exterior in practice
    "hero": "/assets/deals/<slug>/hero.jpg",
    "exterior": "/assets/deals/<slug>/exterior.jpg",
    "property": ["/assets/deals/<slug>/…"],  // optional array, currently unused by components
    "credit": "Photos: … / Pexels"           // shown wherever imagery appears
  },

  "marketLabel": "…",                        // optional — submarket name shown in the Market Pulse intro
  "marketAsOf": "…",                          // optional — the scan's recency (latest period WITH data, anchored to today)

  "marketFindings": [                        // optional but expected — drives the Market Pulse section
    { "tag": "supportive",                   // "supportive" | "watch" | "challenge"
      "headline": "…", "body": "…",
      "sources": [{ "title": "…", "url": "https://…" }],  // REQUIRED: ≥1 real, working link per finding — verify it first; publish is BLOCKED without it
      "date": "…" }                          // the finding's real period (current, not a fixed old quarter)
  ]
}
```

Field consumers (so you know what breaks if one is wrong): `name`/`location.display`
→ hero, model, `<title>`; `copy.tagline` → hero + meta description; `property.*` →
spec grid + model chips; `transaction.*` → transaction snapshot; `copy.thesis`/
`marketNotes` → thesis section; `marketFindings` → Market Pulse (section omitted if
empty); `teaser` → gate + model hero; `engine` → the entire interactive model;
`status` → whether it appears on the home list.

---

## Engine contract (the part `build` can't check)

The `engine` block is the immutable DEAL record the finance engine
(`portal/src/lib/engine.js`) runs. All rates are **decimals**. Required fields:

```jsonc
"engine": {
  "equity": 4813998, "loan": 6800000,    // dollars; usually = transaction.totalEquity / agencyDebt
  "rate": 0.0523,                        // loan interest rate (IO), decimal
  "lpShare": 0.90, "gpShare": 0.10,      // MUST sum to 1
  "pref": 0.08, "promote": 0.20,         // 8% pref, 20% promote
  "moicHurdle": 2.5,                     // super-promote LP-MOIC hurdle (50/50 above it)
  "assetMgmt": 0.01, "sellCost": 0.01,   // 1% of equity p.a.; 1% of gross sale
  "baseOcc": 0.95,                       // base-case stabilised occupancy
  "baseNOI":  [/* per-year NOI  */],     // see rules below
  "baseOpex": [/* per-year OpEx */]      // see rules below
}
```

**Rules that aren't in the schema — get these right or the model breaks or lies:**

- **`baseNOI` and `baseOpex` must be the same length.** The engine zips them
  index-by-index (`NOI[i] + OpEx[i]` to recover revenue); unequal lengths produce
  `NaN` across the whole model. The schema won't catch this — the validator will.
- **Provide the full pro-forma horizon** (ideally ≥ 8 years). The model exits at a
  7-year hold and reads **year-8 NOI** for the exit valuation. Shorter arrays are
  auto-extrapolated (revenue +2.6%/yr, opex +2.8%/yr); that's fine but flag it as
  estimated. Arrays drive value-add stories — e.g. Four Seasons jumps NOI $694K→$925K
  in Year 2 as renovations land.
- **`baseNOI[i]` is net operating income** (revenue − opex) for year i; **`baseOpex[i]`
  is operating expense** for year i. Revenue is recovered as their sum. If you only
  have a cap rate + price, generate a defensible (not optimistic) NOI stream per the
  dashboard SKILL §4 and flag the whole stream as estimated.
- **`equity`/`loan` normally mirror `transaction.totalEquity`/`agencyDebt`.** Keep
  them consistent unless the GP's capital stack genuinely differs.
- **Derive the `teaser` from the model, not from the OM headline.** After authoring,
  run the engine (the validator prints Deal IRR / MOIC / LP IRR / LP MOIC). Set
  `teaser.targetIRR` ≈ LP IRR and `teaser.equityMultiple` ≈ LP MOIC (rounded, with a
  `~`). The validator warns if the headline drifts > 4 pts / 0.3× from the model.
- **Hold note:** the interactive model always *opens* at a 7-year hold (the slider
  moves 3–10). `teaser.holdYears` is display copy. If the deal's thesis hold ≠ 7,
  the headline and the model's default differ — tell the GP, and prefer a 7-year
  framing in copy unless they want otherwise.

---

## Images

Deal imagery lives at `portal/public/assets/deals/<slug>/` and is referenced from
the record as `/assets/deals/<slug>/<file>` (the `public/` prefix is dropped at
serve time). The portal duotones everything, so source/quality is forgiving.

- **GP-provided photos:** save them into `portal/public/assets/deals/<slug>/` as
  `hero.jpg` and `exterior.jpg` (the two the components read). Set `images.credit`
  if attribution is needed.
- **No photos:** source tasteful placeholders (the Pexels MCP is available — search
  the asset class / city, e.g. "townhome community exterior", "apartment building
  dusk"), download into the slug dir, and set `images.credit`
  (e.g. `"Photos: <photographer> / Pexels"`). Match Four Seasons' restraint —
  architectural/exterior, no people, no stock-photo cheese.
- Keep filenames `hero.jpg` / `exterior.jpg`. Reasonable size (long edge ~2000px).

---

## Status

- **`active`** → appears on the home list (`/`) **and** the deal page is live.
- **`fundraising` / `closed`** → **hidden from the home list**, but the deal page is
  still reachable by direct link (`/deals/<slug>`). Useful for soft-launching a deal
  to a specific prospect, or keeping a closed deal accessible.

> There is no hard "draft → 404" gate (that was the deprecated web-admin spec). If
> the GP ever needs a deal page that 404s to the public until launch, that's a small
> follow-up to `[slug].astro` — flag it, don't silently assume it.

---

## Validate (all green before shipping)

From `portal/`:

```
npm run build                  # Astro validates the record shape against the schema
npm run validate-deal -- <slug>  # runs the real engine: equal arrays, finite IRR, DSCR, teaser-vs-model
npm test                       # engine parity stays 18/18 (you never touch engine.js)
```

`validate-deal` prints the base-case Deal IRR / MOIC / LP IRR / LP MOIC — use those
numbers to set the teaser and to sanity-check against any sponsor figures the GP
gave (the base case should roughly reproduce the sponsor pro forma; if it's wildly
off, your NOI/opex arrays or capital structure are wrong). Resolve every error and
review every warning before committing.

---

## Ship

Deals go live by committing to git — Vercel auto-deploys `master`.

```
cd portal
git add src/content/deals/<slug>.json public/assets/deals/<slug>/
git commit -m "Add <Deal Name> deal to portal"
git push
```

Then confirm: the push triggers a Vercel build (~1 min); the deal appears on the
home list (if `active`) and at `/deals/<slug>`. If the GP only wants to stage it,
commit with `status: "fundraising"` so it's hidden from the home list but linkable.

> **Boundaries.** Never touch `portal/src/lib/engine.js` or the `GSAP/` vendor dir.
> Never weaken the Supabase `leads` RLS or expose its service path. Keep the record
> pure data — no styling. Ask before changing the content schema (`config.ts`) or
> the deal/home rendering contract; those affect every deal.

---

## Memory (learn every time)

After publishing, record durable facts/preferences so the next deal needs less
input — to `MEMORY.md` and, for underwriting/structure preferences, the
`## Memory log` in `Fireside Investor Dashboard — SKILL.md` (so both output paths
learn the same defaults). Examples: a corrected house default, a recurring co-GP,
a market the GP keeps buying in, a naming or copy preference. Don't store one-off
deal trivia the record already captures — store the non-obvious preference behind
it. When the GP says "remember this," write it immediately and confirm in one line.

---

## Self-edit

If the GP asks to change *how deals are published* — a new field, a different
default, a copy/section change, a tweak to validation or the deploy flow — treat it
as an edit to this skill: confirm in one line, edit this file (bump `version` +
`last_updated`, add a `## Changelog` entry), and, if the change is to the record
shape, update `config.ts` and the consuming component together. Distinguish "change
this one deal" (edit its JSON) from "change how we publish deals" (edit this skill).

---

## Changelog

- **v1.0.0 — 2026-06-25** — Initial skill. Portal deal-publishing pipeline: intake →
  flagged house defaults → live market scan → author `content/deals/<slug>.json` to
  the schema → wire imagery → validate (build + `validate-deal` engine check + engine
  parity) → ship via git/Vercel. Reuses the CRE brain from `Fireside Investor
  Dashboard — SKILL.md`; adds `tools/validate-deal.mjs` to catch financially-broken
  records the schema can't (mismatched arrays, non-converging IRR, lying teaser).
