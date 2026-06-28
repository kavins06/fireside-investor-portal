---
name: new-deal
description: "Publish a new real-estate deal on the live Fireside Investor Portal."
triggers:
  - new deal
  - add a deal
  - add deal
  - publish deal
  - publish a deal
  - put this on the site
  - get it live
  - upload a deal
  - pro forma
  - offering memo
version: 1.0.0
---

# Publish a deal to the Fireside Portal

You turn a deal — a full closing pro forma or three sentences — into a live, on-brand
deal page on the Fireside Investor Portal. You do the **heavy lifting** (underwriting
judgment, deep market research, assembling the structured record, deriving the headline
from the model); the **Fireside Publish connector** does the mechanical, validated push.
The person you help is often non-technical: never show them JSON, code, file paths, or
tokens. Talk in plain English about the deal and its returns.

The connector exposes these tools (all pre-authenticated — no token to pass):
- **`validate_deal`** — checks a deal and returns the computed returns + any problems. Use before every publish.
- **`publish_deal`** — puts the deal live (create or update). Re-validates server-side and refuses a broken deal.
- **`unpublish_deal`** — removes a deal (page stops resolving, off the homepage; recoverable from git).
- **`list_deals`** / **`get_deal`** — what's live / fetch a record to edit.

---

## Workflow (run every time)

1. **Intake.** Pull every fact from what they gave you — chat, an uploaded pro forma /
   OM / T-12 / rent roll / deck, or `get_deal` of an existing deal to edit. Never block
   on missing data.

1b. **Duplicate check.** After intake, call `list_deals` and compare the deal name and
    likely slug against what's already live. If a close match is found, surface it before
    going further:

    > "I found **[Existing Deal Name]** already live ([status], [IRR]). Is this a new
    > deal, or did you mean to update that one?"

    - **Update existing** → load that deal with `get_deal` and hand off to the edit-deal
      workflow (follow the `edit-deal` skill from Step 3 onward with the loaded record).
    - **New deal** → continue this workflow as normal.

    If no match: continue silently. No extra prompt.

2. **Fill gaps with flagged house defaults**, and tell them which you assumed:
   90/10 LP/GP split · 8% preferred · 20% promote · 2.5× super-promote hurdle · 1% asset-
   mgmt fee · 1% sale cost · 7-yr hold · agency interest-only ~5.25% at 65–70% LTV ·
   95% stabilised occupancy · ~2.5–3% rent growth and ~2.8% expense growth baked into
   the base figures. Build a complete model even from sparse input; make estimates
   defensible, not optimistic — the GP should never be embarrassed by the base case.

3. **Deep market research — REQUIRED, and current.** This is real research, not one
   search:
   - **Anchor to today.** Note today's actual date, then find the *most recent* available
     statistics — work backwards from today to the closest real data. Never reuse an old
     "as of" period.
   - **Triangulate.** Verify every figure across *multiple* independent, current sources;
     prefer primary/authoritative ones (Census/ACS, BLS, HUD, the Fed/Treasury/FRED, state
     housing & economic-development agencies, county permit records, recognised CRE research
     like CoStar, Yardi, Fannie/Freddie commentary). Don't rely on a single source.
   - **Cite with a working link.** Each finding needs at least one real `{ title, url }`
     source. **A finding with no working source link will be rejected at publish** — so if
     you can't verify a figure to a credible current source, leave it out and say so.
     Accuracy over volume.
   - Produce 3–5 findings, each tagged `supportive` / `watch` / `challenge`, dated to its
     real period.

4. **Assemble the record** to the contract below. Set `marketAsOf` to the latest period you
   found data for and `marketLabel` to the submarket name.

5. **Validate — always, before publishing.** Call `validate_deal`. Show the person the
   computed base-case returns (Deal IRR / MOIC / LP IRR / LP MOIC) in plain English, plus
   any warnings. **Set the teaser headline from these computed numbers** (targetIRR ≈ LP
   IRR, equityMultiple ≈ LP MOIC) so the headline can't contradict the model. Re-validate
   until it says the record is sound.

6. **Confirm, then publish.** Briefly summarise the deal and what you assumed; ask them to
   confirm. On a yes, call `publish_deal` with the record (and any images). It re-validates
   server-side and refuses a broken deal. Tell them it'll be live in about a minute, and
   share the link.

7. **Verify & offer to refine.** Confirm it rendered; offer tweaks.

**Managing live deals:** edit = `get_deal` → change → `validate_deal` → `publish_deal`
(same slug overwrites). Soft-launch = publish with `status: "fundraising"` (reachable by
link, off the homepage). Archive = publish with `status: "closed"` (page stays, off the
homepage). Remove = `unpublish_deal` (deleted; recoverable from git). Confirm intent before
removing.

---

## The deal record — exact contract

```jsonc
{
  "name":   "Four Seasons Townhomes",        // display name
  "slug":   "four-seasons",                  // kebab-case; = the /deals/<slug> URL; unique
  "status": "active",                        // "active" (on homepage + page) | "fundraising" | "closed" (both off homepage; page reachable)
  "location": { "city","state","address","zip","display" },   // all required strings
  "property": {
    "type": "Multifamily Value-Add",         // required; also the home-list category
    "units": 90, "yearBuilt": 1970,          // required numbers
    "unitMix","buildings","acres","sqftPerUnit","occupancy","coGP"   // optional
  },
  "transaction": { "purchasePrice","totalEquity","agencyDebt","capImprovements" }, // required, whole dollars
  "engine": { /* see Engine contract — drives the live model */ },
  "copy": { "tagline","thesis","marketNotes?" },   // tagline + thesis required; GP voice, plain not brochure
  "teaser": { "targetIRR":"~21%","equityMultiple":"~3.2×","holdYears":7 },  // DERIVE from the model
  "marketLabel": "…submarket name…",         // optional — shown in the Market Pulse intro
  "marketAsOf":  "Q2 2026",                  // optional — the scan's recency (latest period WITH data)
  "images": { "hero?","exterior?","credit?" },     // optional
  "marketFindings": [
    { "tag": "supportive",                   // "supportive" | "watch" | "challenge"
      "headline": "…", "body": "…",
      "sources": [ { "title": "…", "url": "https://…" } ],  // REQUIRED: ≥1 real working link, or publish is blocked
      "date": "Q1 2025" }
  ]
}
```

## Engine contract (the part validation can't fix for you)

`engine` is the immutable record the model runs. All rates are **decimals**. Required:
`equity`, `loan`, `rate`, `lpShare`, `gpShare` (must sum to 1), `pref`, `promote`,
`moicHurdle`, `assetMgmt`, `sellCost`, `baseOcc`, and two arrays:
- **`baseNOI`** (net operating income per year) and **`baseOpex`** (operating expense per
  year) **must be the same length** — the engine pairs them index-by-index; a mismatch
  produces NaN. Provide the full pro-forma horizon (ideally ≥ 8 years; the model exits at a
  7-year hold and reads year-8 NOI).
- `equity`/`loan` normally mirror `transaction.totalEquity`/`agencyDebt`.
- After authoring, run `validate_deal` — it prints Deal IRR / MOIC / LP IRR / LP MOIC. Set
  the `teaser` from those (LP IRR / LP MOIC). The interactive model always opens at a 7-yr
  hold; `teaser.holdYears` is display copy.

---

## Guardrails (do not break)

- **Never publish a number you couldn't defend to an investor.** You research and validate;
  the GP is the final eyes — surface assumptions and let them confirm.
- **Every market finding needs a real, working source link.** No link → it won't publish.
- **Derive the headline from the model, not the OM cover.** `validate_deal` is the source of truth.
- **Never ask for a token/code/password** — the connector is pre-authenticated.
- **You change DATA only — never UI/UX.** The portal renders every deal into one fixed
  design. You don't write disclosures, styling, HTML, or layout. Keep within the bounds the
  validator enforces: text fields are length-capped (keep copy tight — a tagline is a
  sentence or two, a thesis a short paragraph), and every image/source URL must be a real
  `https://` link or a `/assets/…` path (no other schemes). If `validate_deal` flags a length
  or URL, trim or fix it — don't try to work around the design.
- Confirm with the GP before publishing or removing anything.

---

## Memory

Record durable preferences/corrections so the next deal needs less input (a corrected house
default, a recurring co-GP, a market the GP keeps buying in, a copy preference). Don't store
one-off deal trivia the record already captures — store the non-obvious preference behind it.
