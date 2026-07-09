# Fireside Publish — Claude Code plugin

Publish and manage deals on the live Fireside Investor Portal just by chatting
with Claude. **Nothing to install or configure — upload the plugin and start.**

There are two distribution paths — see `portal/docs/cowork-publish-setup.md`
for the publisher-facing version of both:

- **claude.ai (most publishers):** they add the connector URL under
  Settings → Connectors and type an access code once on the connect page —
  an OAuth handshake (`portal/src/lib/oauth.ts` + `portal/src/pages/api/oauth/*`)
  wraps the same token check below, because claude.ai's Connectors UI only
  supports OAuth, not the static-header auth Claude Code understands.
- **Claude Code (terminal):** open this `.plugin` file directly — the token
  is already baked into `.mcp.json`, no OAuth involved.

---

## For publishers (the easy part)

1. **Open the `fireside-publish.plugin` file in Claude** and accept it.
2. If Claude asks to connect the **Fireside Publish** connector, approve it once.
3. That's it. Chat:
   - **`/new-deal`** — add a deal (paste numbers, describe the property, or attach a pro forma / OM / deck).
   - **`/edit-deal`** — update a live deal.
   - **`/deals`** — list what's live.

No logins, no tokens, no terminal, no setup. Claude does the underwriting judgment,
deep market research, and validation; the connector does the validated publish. Your
deal is live in about a minute.

---

## How it works (for the admin)

```
.claude-plugin/
  plugin.json           # plugin metadata
.mcp.json               # the Fireside connector (pre-wired with the access token)
commands/               # /new-deal, /edit-deal, /deals
skills/                 # the guided authoring + edit workflows
```

The plugin carries **no logic and no GitHub credentials** — only a pre-authenticated
pointer to the Fireside connector (`/api/mcp`), with the access token baked into
`.mcp.json`. All the real work happens server-side:

- **`validate_deal`** runs the real finance engine and returns the computed returns.
- **`publish_deal`** re-validates, then commits the deal to the portal repo → Vercel
  auto-deploys.
- **`unpublish_deal` / `list_deals` / `get_deal`** manage what's live.

Because the connector is server-side, a publisher's machine runs nothing. The GitHub
write-token never leaves the server (it's a Vercel env var), so the plugin you hand out
does **not** contain it — only the connector access token.

---

## Access & security (admin)

- **The plugin's `.mcp.json` holds the connector access token.** Whoever has the plugin
  can publish — so share it only with people you trust, and don't post it publicly.
  The same value is also the "access code" claude.ai publishers type once on the
  connect page.
- **Three server-side secrets live only in Vercel**, never in the plugin:
  - `MCP_PUBLISH_TOKEN` — the value baked into `.mcp.json`; the connector's gate
    (also what the OAuth `/authorize` page checks, and what `/token` hands back
    as the `access_token`).
  - `GITHUB_TOKEN` — the fine-grained PAT (Contents: Read+write) the server uses to commit.
  - `OAUTH_SIGNING_SECRET` — signs the stateless OAuth client IDs and authorization
    codes issued to claude.ai (see `portal/src/lib/oauth.ts`). Not a publish credential
    itself — rotating it just forces everyone's claude.ai connector to re-register
    (harmless; they'll just see the connect page again).
- **Revoke everyone:** rotate `MCP_PUBLISH_TOKEN` in Vercel and redeploy. claude.ai
  publishers are locked out immediately (their access code stops working); re-issue
  the plugin with the new value for Claude Code publishers too.

---

## Deal status

| Status | Homepage | Deal page | Use for |
|---|---|---|---|
| `active` | Listed | Live | Open to all investors |
| `fundraising` | Hidden | Live | Share by link — soft launch or private preview |
| `closed` | Hidden | Live | Deal closed — record stays, nothing disappears |

---

*Internal tool for Fireside Strategies, LLC.*
