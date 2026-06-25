# Publish Fireside deals from Claude Cowork — setup (2 minutes, once)

This lets you add deals to the live Fireside portal just by talking to Claude. You
do it once; after that, publishing a deal is a normal conversation.

You'll need two things from the GP:
1. The **connector URL** (looks like `https://portal-eta-peach.vercel.app/api/mcp`)
2. Your **publish token** (a short secret string)

---

## Step 1 — Add the Fireside connector (once)

1. In Claude, open **Settings → Connectors** (on Pro/Max it may read **Customize → Connectors**).
2. Click **Add custom connector**.
3. Paste the **connector URL** the GP gave you.
4. Leave authentication empty (no sign-in needed) and click **Add**.
5. You'll see a one-time note that custom connectors aren't verified by Anthropic — that's expected for an in-house tool. Confirm.

That's it — "Fireside Publish" now appears in your connectors.

> In a chat, make sure the connector is switched on: click the **+ / connectors**
> button in the message box and enable **Fireside Publish**.

## Step 2 — Save your publish token (once)

Tell Claude, in your **Fireside Portal** workspace:

> "My Fireside publish token is `the-token-the-GP-gave-me`. Save it."

Claude stores it in that workspace's memory so you don't have to paste it every time.
Keep this token private — it's what lets you publish. Don't put it on the website or
share it.

---

## Publishing a deal

Just talk to Claude in the **Fireside Portal** workspace. For example:

> "Add a new deal to the portal." *(then paste the details, or attach the pro forma / offering memo)*

Claude will:
1. Build the deal from what you gave it, filling any gaps with Fireside's standard assumptions (and telling you which it assumed).
2. **Check it** and show you the projected returns (IRR, equity multiple, LP figures). If something's off, it'll say so and fix it — it cannot publish broken numbers.
3. Ask you to confirm, then **publish**. The deal is live on the site in about a minute.

Other things you can say:
- "What deals are live right now?"
- "Update the Maple Street deal — the exit cap should be 6.5%."
- "Put this one up but keep it off the homepage for now." *(publishes as “fundraising” — reachable by link, not listed)*

## If something doesn't work

- **"Publish rejected: missing or incorrect publish token"** → your saved token is wrong; ask the GP for it again and re-save it (Step 2).
- **It lists problems with the deal** → those are real (e.g. missing numbers); answer Claude's questions and it'll fix and re-check.
- **The connector isn't offered** → make sure it's toggled on via the **+ / connectors** button in the message box.
