# Publish Fireside deals from Claude — setup guide

You can add, edit, and manage deals on the Fireside website just by chatting
with Claude — no logins, no spreadsheets, no code. Setup takes under a minute.

There are two ways to connect, depending on what you use day to day. If
you're not sure, use **claude.ai** — that's what most publishers should use.

---

## Option A — claude.ai (recommended for most people)

1. Go to **claude.ai → Settings → Connectors → Add custom connector**.
2. Paste the connector URL your admin gave you (ends in `/api/mcp`) and add it.
3. Claude will open a **Connect Fireside Publish** page asking for an access
   code. Enter the code your admin gave you — this is a one-time step per
   device.
4. That's it. In any chat you'll have `/new-deal`, `/edit-deal`, and `/deals`
   available (ask your admin for the matching skill files if they don't show
   up automatically).

### If something doesn't work

- **"Couldn't register with fireside-publish's sign-in service"** → this
  should no longer happen; if it does, the connector's OAuth layer may not be
  configured server-side (`OAUTH_SIGNING_SECRET` missing in Vercel) — tell
  your admin.
- **"That code is not correct"** on the connect page → double check the
  access code with your admin; it may have been rotated.
- **Deal rejected at publish** → Claude will list exactly what's wrong.
  Answer its questions and it re-validates automatically.

---

## Option B — Claude Code (terminal)

If you already use Claude Code day to day:

1. **Open the `fireside-publish.plugin` file in Claude Code** and accept it.
2. If Claude asks to connect the **Fireside Publish** connector, approve it
   once — the access token is already baked into the plugin file, nothing to
   type.
3. That's it — `/new-deal`, `/edit-deal`, `/deals`.

> Older instructions for this option (a `FIRESIDE_TOKEN` environment
> variable + a separate marketplace repo) are retired — ignore any guide
> that mentions `setx FIRESIDE_TOKEN` or `/plugin install fireside-publish@fireside`.

### If something doesn't work

- **"Unauthorized" or connector errors** → the token baked into your plugin
  file no longer matches the server. Ask your admin to re-issue you the
  current `fireside-publish.plugin` file.
- **Plugin commands not showing** → re-open the `fireside-publish.plugin`
  file, then restart Claude.

---

## Publishing deals (same in both options)

### Add a new deal

```
/new-deal
```

Paste in the deal details, or attach a pro forma / offering memo / deck.
Claude will build the deal, fill gaps with Fireside's standard assumptions
(and tell you which ones it assumed), show you the projected returns, then
ask you to confirm before publishing. It's live on the website in about a minute.

### Edit an existing deal

```
/edit-deal
```

Claude shows you what's live, you pick the deal and describe what to change.
It applies the edits, re-validates the numbers, shows you a before/after summary,
and publishes on your say-so.

You can change numbers, copy, images, market findings, hold period, or status
all in one session.

### See what's live

```
/deals
```

Shows all current deals — name, status, IRR, and location. Read-only.

---

## Deal status

| Status | Homepage | Deal page | Use for |
|---|---|---|---|
| `active` | Listed | Live | Open to all investors |
| `fundraising` | Hidden | Live | Share by link — soft launch or private preview |
| `closed` | Hidden | Live | Deal is done — record stays, nothing disappears |

To take a deal off the homepage without removing it: `/edit-deal` → set status
to `closed` or `fundraising`.

---

*Admin reference: `fireside-publish-plugin/README.md` in the portal repo
covers how the connector is built, distributed, and how to rotate access.*
