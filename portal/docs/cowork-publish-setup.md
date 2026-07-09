# Publish Fireside deals from Claude — setup guide

You can add, edit, and manage deals on the Fireside website just by chatting
with Claude — no logins, no spreadsheets, no code. Setup takes under a minute.

> This doc describes the **current (v3) flow**: a single plugin file with the
> connector pre-wired. There is no environment variable to set, no
> marketplace to register, and no URL to paste. (Earlier versions of this
> project used a `FIRESIDE_TOKEN` env var + marketplace install — that flow
> is retired; ignore any instructions that mention `setx FIRESIDE_TOKEN` or
> `/plugin install fireside-publish@fireside`.)

---

## What you need

- **Claude Code or Claude Desktop**
- **The `fireside-publish.plugin` file** — get this from your admin. It has
  the connector (and your access) already baked in.

---

## Setup (once)

1. **Open the `fireside-publish.plugin` file in Claude** and accept it.
2. If Claude asks to connect the **Fireside Publish** connector, approve it once.
3. That's it. You'll see three new commands: `/new-deal`, `/edit-deal`, `/deals`.

No logins, no tokens to type, no terminal, no setup.

---

## Publishing deals

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

## If something doesn't work

- **"Unauthorized" or connector errors** → the access token baked into your
  plugin file no longer matches the server. Ask your admin to re-issue you
  the current `fireside-publish.plugin` file (this happens automatically
  whenever the admin rotates the token, e.g. after a security review).
- **Plugin commands not showing** → re-open the `fireside-publish.plugin`
  file, then restart Claude.
- **Deal rejected at publish** → Claude will list exactly what's wrong. Answer
  its questions and it re-validates automatically.

---

*Admin reference: `fireside-publish-plugin/README.md` in the portal repo
covers how the plugin is built, distributed, and how to rotate access.*
