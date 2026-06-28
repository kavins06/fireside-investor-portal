# Fireside Publish — Claude Code plugin

Publish and manage deals on the live Fireside Investor Portal just by chatting
with Claude. No logins, no spreadsheets, no JSON. One-time setup: paste a GitHub
token into the plugin's `config.json`.

---

## What's inside

This plugin lives inside the **`fireside-investor-portal`** repo (one repo for the whole
project — the live site under `portal/`, this plugin under `fireside-publish-plugin/`).

```
.claude-plugin/
  plugin.json           # plugin metadata
config.json             # GitHub token + repo/branch the publisher commits to  ← set this once
commands/
  new-deal.md           # /new-deal  — add a deal to the portal
  edit-deal.md          # /edit-deal — update a live deal
  deals.md              # /deals     — list all live deals (read-only)
skills/
  new-deal/SKILL.md     # full guided workflow: intake → research → validate → publish
  edit-deal/SKILL.md    # full guided workflow: load → edit → validate → republish
scripts/
  fireside.mjs          # the publisher CLI: validate / publish / get / list / unpublish
  validate.mjs          # deal validation (shape + the real finance engine)
  schema.mjs            # deal shape rules (dependency-free port of the portal schema)
  engine.mjs            # the finance engine (same model the live site renders)
  github.mjs            # commits the deal JSON to the repo via the GitHub API
  selfcheck.mjs         # offline sanity check: `node scripts/selfcheck.mjs`
```

There is **no MCP server**. Publishing happens entirely on your machine: the
skills do the judgment (house defaults, deep-sourced market research, model-derived
headline, guardrails), then the bundled `fireside.mjs` validates the deal against
the real finance engine and commits the record straight to the portal repo through
the GitHub API — which triggers a Vercel auto-deploy. Pure Node, zero `npm install`.

---

## How access works (read this)

The publisher commits to the portal repo using a **GitHub token stored in
`config.json`** inside the plugin. That makes publishing one step (no env vars, no
sign-in) — but it also means:

- **Treat the configured plugin as a secret.** Anyone who has the plugin folder with
  a real token in `config.json` can publish to the portal. Don't share it, and don't
  commit `config.json` with a live token to a public repo.
- **Use a least-privilege token.** A GitHub **fine-grained PAT** scoped to *only* the
  `kavins06/fireside-investor-portal` repo with **Contents: Read and write**. Nothing else.
- **Revoke by rotating.** Delete/rotate the PAT in GitHub settings to cut off access;
  paste the new one into `config.json`.

---

## Setup (once)

**1. Install the plugin.** Two ways:

- **Easiest (turnkey):** open the `fireside-publish.plugin` file in Claude (desktop) and
  accept. Best for handing it to a non-technical publisher — the token is already inside.
- **From the repo:** in any Claude Code chat —
  ```
  /plugin marketplace add kavins06/fireside-investor-portal
  /plugin install fireside-publish@fireside
  ```
  (Installs the plugin source; you then add your token — see step 3.)

**2. Create the GitHub token.** GitHub → Settings → Developer settings →
Fine-grained tokens → *Generate new token*. Repository access: only
`kavins06/fireside-investor-portal`. Permissions: **Contents → Read and write**.

**3. Paste it into `config.json`:**

```json
{
  "githubToken": "github_pat_...your token...",
  "repo": "kavins06/fireside-investor-portal",
  "branch": "master",
  "siteUrl": "https://portal-eta-peach.vercel.app"
}
```

That's it. (Prefer not to keep the token in the file? Set `GITHUB_TOKEN` in your
environment instead — it overrides `config.json`.)

**4. Sanity-check (optional):** `node scripts/selfcheck.mjs` → prints `selfcheck OK`.

---

## Using it

### `/new-deal`
Add a deal. Paste numbers, describe the property, or attach a pro forma / OM / deck.
Claude intakes the deal, fills gaps with flagged Fireside house defaults, does deep
multi-source market research (every figure cited with a working link), assembles the
record, shows you the computed returns, then publishes on your confirmation. Live in ~1 min.

### `/edit-deal [deal name]`
Update a live deal. Claude loads what's on the site, applies your changes — numbers,
copy, images, status, market findings, all in one session — re-validates, shows you a
before/after summary, and republishes on your say-so.

### `/deals`
See all live deals — name, status, target IRR, location. Read-only.

---

## Deal status

| Status | Homepage | Deal page | Use for |
|---|---|---|---|
| `active` | Listed | Live | Open to all investors |
| `fundraising` | Hidden | Live | Share by link — soft launch or private preview |
| `closed` | Hidden | Live | Deal closed — record stays, nothing disappears |

---

## Under the hood

`fireside.mjs` is the only thing Claude runs to publish:

```
node scripts/fireside.mjs validate  deal.json        # shape + real engine; prints returns
node scripts/fireside.mjs publish   deal.json [--image hero.jpg]   # validate, commit, deploy
node scripts/fireside.mjs get       four-seasons      # print a live deal's JSON to edit
node scripts/fireside.mjs list                        # slugs of all live deals
node scripts/fireside.mjs unpublish test-deal         # remove a deal (recoverable from git)
```

`validate` runs the same finance engine the live site renders with, so the returns you
approve are the returns investors see. `publish` re-validates and refuses a broken deal.
Deals are committed as JSON to `portal/src/content/deals/<slug>.json`; the Vercel build
does the rest.

---

*Internal tool for Fireside Strategies, LLC.*
