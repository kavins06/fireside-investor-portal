# Add Fireside deals from Claude — quick setup

> **GP:** paste this whole message to each publisher, along with two things only you
> can give them: the **connector link** (`https://portal-eta-peach.vercel.app/api/mcp`)
> and their **publish code** (the secret string). Everything below is written for them.

---

You can add deals to the Fireside website just by chatting with Claude — no website
logins, no spreadsheets, no code. It's a one-time setup, then it's a normal
conversation. You'll get two things from the GP:

- a **connector link** (a web address)
- a **publish code** (a private password — keep it to yourself)

## 1. Connect Fireside to Claude (once, ~1 minute)

1. In Claude, open **Settings → Connectors** (on some plans it reads **Customize → Connectors**).
2. Click **Add custom connector**.
3. Paste the **connector link** the GP gave you. Leave everything else blank and click **Add**.
4. If Claude warns that the connector "isn't verified by Anthropic," that's normal for an
   in-house tool — go ahead.

Done — **Fireside Publish** is now connected. When you start a chat, if it isn't already
active, click the **+** (or "connectors") button next to the message box and switch on
**Fireside Publish**.

## 2. Add a deal

Start a chat and say, for example:

> **"Add a new deal to the Fireside website."**

Then paste the deal details, or attach the pro forma / offering memo / deck.

Claude will:
1. **Build the deal** from what you gave it, filling any gaps with Fireside's standard
   assumptions — and telling you which ones it assumed.
2. The first time, **ask for your publish code** — paste it and say *"remember this"* so
   you won't be asked again.
3. **Show you the projected returns** and check the numbers. It cannot publish broken
   figures — if something's off it tells you and fixes it.
4. **Ask you to confirm, then publish.** It's live on the website in about a minute.

You can also say things like:
- "What deals are live right now?"
- "Update the Maple Street deal — change the exit cap to 6.5%."
- "Add this one but keep it off the homepage for now." *(stays reachable by link, not listed)*

## If something doesn't work

- **"missing or incorrect publish token"** → your publish code is wrong. Ask the GP for
  it again and paste it in.
- **Claude lists problems with the deal** → they're real (usually a missing number) —
  just answer its questions and it'll fix and re-check.
- **You don't see "Fireside Publish" as an option** → click the **+** / connectors button
  by the message box and switch it on.

---

*Optional, for richer deal-writing: the GP can set up a dedicated "Fireside Portal"
workspace in your Claude (it teaches Claude Fireside's underwriting style). Not required —
the steps above work on their own.*
