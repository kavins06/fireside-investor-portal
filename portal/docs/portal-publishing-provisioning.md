# Go-live checklist — Fireside Publish connector (superseded)

> **This document describes a retired design and is kept for history only.**
> It described an early "open connector, no publish token" model. That model
> was deliberately reverted (see `fireside-publish-plugin/.claude-plugin/plugin.json`
> version 3.0.0, "revert to hosted connector") because an unauthenticated
> `publish_deal` / `unpublish_deal` endpoint lets anyone with the URL publish
> or remove live deals.
>
> **The current design is token-gated.** `portal/src/pages/api/mcp.ts` requires
> `Authorization: Bearer <MCP_PUBLISH_TOKEN>` on every request — no valid
> token, no access. `MCP_PUBLISH_TOKEN` **is required** in Vercel; do not
> delete it (an earlier version of this doc incorrectly said otherwise).
>
> For current setup and admin instructions, see:
> - `fireside-publish-plugin/README.md` — how the plugin is built, distributed,
>   and how to rotate access.
> - `portal/docs/cowork-publish-setup.md` — what to hand a non-technical publisher.
