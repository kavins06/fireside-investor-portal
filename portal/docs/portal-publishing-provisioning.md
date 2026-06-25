# Go-live checklist — Fireside Publish connector

The code is built and tested. These are the steps **only you** can do (they involve
secrets and account settings I can't touch). ~10 minutes. Order matters.

> This supersedes `docs/spec-gp-admin.md` (the old web-admin design). No login page,
> no admin UI, no Supabase deals table — publishing runs through the connector + git.

## 0. Connect Vercel to GitHub — CRITICAL, do this first

The whole flow (and the redesign, and any future push) depends on Vercel
auto-deploying when GitHub changes. **Right now it doesn't** — the Vercel "portal"
project has no Git integration; it's only ever been hand-deployed via the CLI from
the first commit, which is why the redesign never went live despite being pushed.

Fix it once:
1. Vercel → the **portal** project → **Settings → Git** → **Connect Git Repository**
   → choose **`kavins06/fireside-investor-portal`**, production branch `master`.
2. **Set Settings → Build & Deployment → Root Directory to `portal`** and save (the app
   lives in a subfolder). If you skip this, Git-triggered builds fail with
   `astro: command not found` / `"astro build" exited with 127` — because Vercel builds
   from the repo root, which has no package.json. (The old CLI deploys worked only
   because they ran from inside `portal/`.)
3. Vercel will deploy `master` immediately — that publishes the redesign + the
   connector endpoint. From now on every push (yours, and the connector's deal
   commits) auto-deploys.

Without this step, a publisher's deal will commit to GitHub but never appear on the
site. Everything below assumes this is done.

## 1. Create a GitHub token (lets the connector commit deals)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access:** Only select repositories → **`kavins06/fireside-investor-portal`**.
3. **Permissions:** Repository permissions → **Contents: Read and write** (Metadata: Read is added automatically). Nothing else.
4. Set an expiry you're comfortable with (e.g. 1 year) and generate. **Copy the token** (starts with `github_pat_…`) — you won't see it again.

## 2. Pick a publish token (the secret your publishers will use)

Make up a long random string (e.g. from a password manager), e.g. `fsp_live_7Q2…`.
This is what gates publishing. You'll give it to each trusted publisher.

## 3. Set the environment variables in Vercel

Vercel → your portal project → **Settings → Environment Variables**. Add these for
**Production** (and Preview if you want to test there):

| Name | Value |
| :---- | :---- |
| `GITHUB_TOKEN` | the fine-grained PAT from step 1 |
| `MCP_PUBLISH_TOKEN` | the publish token from step 2 |
| `GITHUB_REPO` | `kavins06/fireside-investor-portal` *(optional — this is the default)* |
| `GITHUB_BRANCH` | `master` *(optional — default)* |
| `PUBLIC_SITE_URL` | `https://portal-eta-peach.vercel.app` *(optional — used for the “it’s live at …” link)* |

(Leave the existing `SUPABASE_*` vars as they are.)

## 4. Deploy

Push to `master` (or redeploy in Vercel). After it deploys, your connector endpoint is:

```
https://portal-eta-peach.vercel.app/api/mcp
```

Quick check it's alive (in a browser it should say "Fireside Publish MCP server…"):
open that URL — a 405 page with that message means the server is up (it only accepts POST).

## 5. Add the connector in Claude (you, as the first publisher)

Follow `cowork-publish-setup.md`: Settings → Connectors → Add custom connector → paste
the `/api/mcp` URL → no auth → Add. Then save your publish token in the **Fireside
Portal** Cowork workspace.

## 6. Smoke-test a real publish

In Cowork: *"Add a test deal to the portal as fundraising"* with a few made-up
numbers. Confirm Claude validates it, publishes, and it appears at
`/deals/<slug>` within ~a minute. Then delete the test deal (tell Claude, or remove
the file from the repo) so it doesn't linger.

## 7. Onboard others

Send each trusted publisher:
- the connector URL (`…/api/mcp`),
- their publish token (the same one, or rotate per-person if you prefer),
- the `cowork-publish-setup.md` card.

---

## Security notes (read once)

- The connector endpoint is **public** (Claude connects from Anthropic's cloud, so it
  has to be). Anyone who finds the URL can *look* at the tools and *validate* a deal,
  but **publishing requires the publish token**, which is never in the URL.
- Worst case if the token leaks: someone could publish a *validated* deal record (the
  only thing the tool can write) — annoying, but it's a normal git commit you can
  revert, and there's no investor data exposed. **Rotate** by changing
  `MCP_PUBLISH_TOKEN` in Vercel and re-sharing.
- Want it locked down harder later? Two options: (a) rotate tokens periodically, or
  (b) switch the connector to real OAuth with a "Sign in to Fireside" step (more
  setup; ask and I'll build it).
- The `GITHUB_TOKEN` and `MCP_PUBLISH_TOKEN` live only in Vercel env vars (server-side)
  — never in the repo, never sent to the browser.

---

## What it costs

You don't pay anything per deal. To be precise about the two meanings of "token":

- **The publish token and GitHub token are just secrets** — passwords/keys, not metered. $0.
- **AI usage** happens in *each publisher's own Claude plan* when they chat to write a deal.
  The connector itself never calls an LLM — it only validates the math and commits to GitHub —
  so there's **no Anthropic bill per deal** for you. (That's why we used the connector instead
  of a server-side AI: the cost stays on whoever does the chatting.)
- **Hosting** (Vercel + GitHub + the Supabase leads table) sits on free tiers at this volume.

| Item | Cost | Who pays |
| :---- | :---- | :---- |
| Publish token / GitHub token | $0 | nobody (they're passwords) |
| Connector endpoint (validate + commit, no AI) | ~$0 | your Vercel hosting (free tier) |
| Claude chat to write a deal | per their plan | each publisher's own Claude subscription |
| Vercel / GitHub / Supabase hosting | free tier | you, ~$0 at this scale |

The only way a publisher spends money is if they're on Claude's free tier and hit its limits
during heavy research — then *they'd* choose to upgrade their own plan.
