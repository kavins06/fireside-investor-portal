---
name: edit-deal
description: "Update a live deal on the Fireside Investor Portal and republish."
triggers:
  - edit deal
  - edit a deal
  - update deal
  - update a deal
  - change a deal
  - modify deal
  - update the deal
  - change the deal
  - deal status
  - set status
version: 1.0.0
---

# Edit a live deal on the Fireside Portal

You make surgical edits to an existing deal and republish it. The publisher tells
you what they want changed — you do it, validate, show the diff, and publish with
one confirmation. You never re-run full market research unless they explicitly ask
to update market findings. You never ask unnecessary questions.

You run the **Fireside publisher CLI** bundled with this plugin (it carries the publish
token in the plugin's `config.json` — never ask the human for a token). Write the updated
record to a temporary `.json` file when validating/publishing. From a terminal:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/fireside.mjs" <command>
```

- **`list`** — all live deals (slugs); pair with `get` for status/IRR/location detail
- **`get <slug>`** — print the full record for a specific deal (the JSON to edit)
- **`validate <deal.json>`** — checks the record, prints computed returns + any errors
- **`publish <deal.json>`** — overwrites the live deal (same slug = update, not new)

---

## Workflow

### Step 1 — Find the deal

Call `list` immediately.

If the user named a deal in their opening message and it matches unambiguously, skip
to Step 2 and load it directly — do not show the list.

Otherwise display a numbered list, one line each:

```
01  Four Seasons Townhomes  active      ~21%   Greensboro, NC
02  Creekside Flats         active      ~11%   San Antonio, TX
```

Ask: **"Which deal?"** — nothing else.

### Step 2 — Load the deal

Call `get`. Reply in one sentence:

> "Got **[Deal Name]** — [status], [IRR], [location]. What would you like to change?"

If the user already described what they want changed (in the same message), skip the
question and go directly to Step 3.

### Step 3 — Understand and apply the changes

Parse what they want. Apply all changes to the record.

**Adaptive rule — the number of questions you ask must match the actual ambiguity:**
- Specific request ("change hold to 5 years, set status to fundraising") → zero
  follow-up questions. Just do it.
- Vague request ("update the numbers") → exactly one question: "Which numbers?"
- Partial request ("raise the IRR") → exactly one question: "To what?"
- Never ask for information already in the deal record.
- Never ask multiple questions in one turn. One gap = one question.

**What you can change:**

| Category | Fields |
|---|---|
| Transaction numbers | purchasePrice, totalEquity, agencyDebt, capImprovements |
| Engine inputs | rate, lpShare, gpShare, pref, promote, moicHurdle, assetMgmt, sellCost, baseOcc, baseNOI (array), baseOpex (array) |
| Hold / teaser | teaser.holdYears, teaser.targetIRR, teaser.equityMultiple |
| Copy | tagline (max 500 chars), thesis (max 5000 chars), marketNotes |
| Market findings | Edit any finding's headline / body / date / sources; add a new finding (≥1 real `https://` source required); remove a finding |
| Images | hero or exterior — publisher provides an `https://` URL or `/assets/` path |
| Status | `active` / `fundraising` / `closed` (see Status reference below) |

**Engine input changes:** if any engine input changes, re-derive `teaser.targetIRR`
and `teaser.equityMultiple` from the `validate` output so the headline always
reflects the actual model — never let a teaser figure contradict the computed returns.

**Never:**
- Call `unpublish` — closed status covers every real use case
- Re-run full market research (that's the new-deal workflow)
- Ask for a token, code, or password

### Step 4 — Validate

Call `validate` with the full updated record.

Show what changed — plain English, not JSON. Before → after for each field:

> - Hold period: **7 yrs → 5 yrs**
> - Status: **active → fundraising**
> - Target LP IRR (recomputed from model): **~21% → ~19%**
> - Computed returns: Deal IRR 22.4%, LP IRR 19.1%, LP MOIC 2.7×

If validation fails: surface only the error(s), fix them or ask for the one missing
input. Re-validate. Don't re-ask anything already answered.

### Step 5 — Confirm and publish

One-line prompt: "**[N] change(s)** to [Deal Name] — publish now?"

On yes: `publish` with the full updated record.

Confirm: "Done. **[Deal Name]** is updated. [link]"

---

## Status reference

| Status | Homepage | Deal page | Use for |
|---|---|---|---|
| `active` | ✅ Listed | ✅ Live | Open to all investors |
| `fundraising` | ❌ Hidden | ✅ Live | Share by link only — soft launch or private preview |
| `closed` | ❌ Hidden | ✅ Live | Deal closed or fully subscribed — record stays, nothing disappears |

`unpublish` is not used in the publisher workflow. Closed is permanent enough.

---

## Memory

If the publisher corrects a recurring preference ("we always use 5-year holds, not 7"),
save it so the next session needs less input. Don't store deal-specific one-off facts —
store the durable preference behind them.
