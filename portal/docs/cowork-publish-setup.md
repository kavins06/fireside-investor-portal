# Publish Fireside deals from Claude — setup guide

You can add, edit, and manage deals on the Fireside website just by chatting with
Claude — no logins, no spreadsheets, no code. Setup takes about five minutes.

---

## What you need

- **Claude Code** — the desktop app (get it at claude.ai/download)
- **Your Fireside token** — a short code your admin gives you once

---

## Setup (once)

### 1. Set your token

Open a terminal and run:

```
setx FIRESIDE_TOKEN "your-token-here"
```

Replace `your-token-here` with the token your admin gave you. Close and reopen
Claude Code after running this — it picks up the new variable on launch.

### 2. Install the Fireside plugin

In any Claude Code chat, run:

```
/plugin install fireside-publish@fireside
```

Claude will confirm it's installed. You'll see **Fireside Publish** appear in your
plugins list with three skills: `/new-deal`, `/edit-deal`, and `/deals`.

That's it. The plugin handles the connection automatically — no URLs to paste,
no connectors to configure.

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

- **"Unauthorized" or connector errors** → your token may be wrong or not set.
  Re-run `setx FIRESIDE_TOKEN "your-token"`, then fully close and reopen Claude Code.
- **Plugin skills not showing** → run `/plugin install fireside-publish@fireside`
  again, then restart Claude Code.
- **Deal rejected at publish** → Claude will list exactly what's wrong. Answer
  its questions and it re-validates automatically.
