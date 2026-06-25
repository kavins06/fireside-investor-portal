/**
 * Fireside Publish — remote MCP server (Streamable HTTP, stateless).
 *
 * This is the connector a non-technical user adds to Claude Cowork (no-auth URL).
 * It exposes a tiny, purpose-built tool surface for publishing deals to the live
 * portal — nothing else is readable or writable. Authentication for the *write*
 * path is a `publish_token` tool argument checked against env (the Claude
 * connector UI has no password field, so the secret rides on the tool call, not
 * the connection).
 *
 * Stateless: each POST is an independent JSON-RPC request/response. No sessions,
 * no SSE, no Redis — which is exactly what a Vercel serverless function wants.
 * The tools are plain request→response, so a single application/json reply per
 * call is sufficient (Streamable HTTP permits this).
 *
 * Tools:
 *   validate_deal  (open)        dry-run: shape + engine soundness, returns a report
 *   publish_deal   (token-gated) validate, then commit to the repo → Vercel deploy
 *   list_deals     (open)        slugs currently live
 *   get_deal       (open)        fetch a deal record to edit
 *
 * ponytail: hand-rolled because the surface is trivial (4 request/response tools,
 * no streaming). If this ever needs sampling/subscriptions, swap in the MCP SDK.
 */
import type { APIRoute } from 'astro';
import { validateDeal } from '../../lib/deal-validation.mjs';
import { publishDeal, fetchDeal, listDeals, deleteDeal } from '../../lib/github-publish';

export const prerender = false;

const SERVER_INFO = { name: 'fireside-publish', version: '1.0.0' };
const DEFAULT_PROTOCOL = '2025-06-18';
const SUPPORTED_PROTOCOLS = new Set(['2025-06-18', '2025-03-26', '2024-11-05']);

const DEAL_SCHEMA_HINT =
  'A complete Fireside deal record (the JSON the portal renders). Required top-level keys: ' +
  'name, slug (kebab-case), status (active|fundraising|closed), location, property, transaction, ' +
  'engine (capital structure + baseNOI/baseOpex arrays of EQUAL length, rates as decimals), copy ' +
  '(tagline, thesis), teaser (targetIRR, equityMultiple, holdYears). Optional: images, marketFindings. ' +
  'Derive teaser figures from the model. See the four-seasons record as the reference shape.';

const TOOLS = [
  {
    name: 'validate_deal',
    description:
      'Check a deal record before publishing — validates its shape and runs the real finance engine, ' +
      'returning errors, warnings, and the computed base-case returns (Deal IRR / MOIC / LP IRR / LP MOIC). ' +
      'No publish token needed. Always run this and show the result before publish_deal.',
    inputSchema: {
      type: 'object',
      properties: { deal: { type: 'object', description: DEAL_SCHEMA_HINT } },
      required: ['deal'],
    },
  },
  {
    name: 'publish_deal',
    description:
      'Publish (create or update) a deal on the live Fireside portal. Re-validates server-side and REJECTS ' +
      'an unsound deal. On success it commits the record (and any images) to the repo and the site redeploys ' +
      'automatically. Requires the Fireside publish token.',
    inputSchema: {
      type: 'object',
      properties: {
        deal: { type: 'object', description: DEAL_SCHEMA_HINT },
        publish_token: { type: 'string', description: 'The Fireside publish token (provided to authorised publishers).' },
        images: {
          type: 'array',
          description: 'Optional images to commit to public/assets/deals/<slug>/. Each is { filename, contentBase64 }.',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string', description: 'e.g. hero.jpg or exterior.jpg' },
              contentBase64: { type: 'string', description: 'base64-encoded image bytes' },
            },
            required: ['filename', 'contentBase64'],
          },
        },
      },
      required: ['deal', 'publish_token'],
    },
  },
  {
    name: 'unpublish_deal',
    description:
      'Remove a published deal from the live portal — deletes its record, so the page 404s and it leaves the homepage. ' +
      'Requires the Fireside publish token. Use for test deals or genuine removals; it stays in git history if it ever needs restoring. ' +
      'To merely hide a deal from the homepage while keeping its page reachable, do NOT use this — publish it with status "closed" instead.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The slug of the deal to remove, e.g. "test-deal".' },
        publish_token: { type: 'string', description: 'The Fireside publish token.' },
      },
      required: ['slug', 'publish_token'],
    },
  },
  {
    name: 'list_deals',
    description: 'List the slugs of deals currently published to the portal.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_deal',
    description: 'Fetch an existing deal record by slug so it can be edited and re-published.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The deal slug, e.g. "four-seasons".' } },
      required: ['slug'],
    },
  },
];

// ── tool-call results are MCP "content" arrays of text ──────────────────────
const textResult = (text: string, isError = false) => ({ content: [{ type: 'text', text }], isError });

function reportText(name: string, v: ReturnType<typeof validateDeal>): string {
  const lines: string[] = [];
  if (v.computed) {
    const c = v.computed;
    lines.push(`${name} — base case (cap 6.25%, 7-yr hold):`);
    lines.push(`  Deal IRR ${(c.dealIRR * 100).toFixed(1)}%   MOIC ${c.mult.toFixed(2)}×   Avg CoC ${(c.avgCoC * 100).toFixed(1)}%`);
    lines.push(`  LP IRR ${(c.lpIRR * 100).toFixed(1)}%   LP MOIC ${c.lpMult.toFixed(2)}×`);
  }
  for (const w of v.warnings) lines.push(`⚠ ${w}`);
  for (const e of v.errors) lines.push(`✗ ${e}`);
  lines.push(v.ok ? '✓ Deal record is sound.' : `✗ ${v.errors.length} error(s) — fix these before publishing.`);
  return lines.join('\n');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Gate the write tools (publish/unpublish). Returns an error string, or null if OK.
function tokenError(given: any): string | null {
  const token = import.meta.env.MCP_PUBLISH_TOKEN ?? process.env.MCP_PUBLISH_TOKEN ?? '';
  if (!token) return 'Publishing is not configured on the server (no publish token set). Contact the GP.';
  const g = String(given ?? '');
  if (!g || !constantTimeEqual(g, token)) return 'Rejected: missing or incorrect publish token.';
  return null;
}

async function callTool(name: string, args: Record<string, any>) {
  switch (name) {
    case 'validate_deal': {
      const v = validateDeal(args?.deal);
      return textResult(reportText(args?.deal?.name ?? '(deal)', v), !v.ok);
    }
    case 'publish_deal': {
      const terr = tokenError(args?.publish_token);
      if (terr) return textResult(terr, true);

      const v = validateDeal(args?.deal);
      if (!v.ok) return textResult('Publish blocked — the deal did not pass validation:\n\n' + reportText(args?.deal?.name ?? '(deal)', v), true);

      const result = await publishDeal({ slug: args.deal.slug, deal: args.deal, images: args?.images });
      if (!result.ok) return textResult(`Publish failed: ${result.error}`, true);

      const warnLine = v.warnings.length ? `\n\nNote:\n${v.warnings.map(w => `⚠ ${w}`).join('\n')}` : '';
      return textResult(
        `✓ Published "${args.deal.name}". It will be live at ${result.dealUrl} within ~1 minute (the site is redeploying).` +
        `\nCommitted ${result.commits.length} file(s).${warnLine}`,
      );
    }
    case 'unpublish_deal': {
      const terr = tokenError(args?.publish_token);
      if (terr) return textResult(terr, true);
      const slug = String(args?.slug ?? '');
      const result = await deleteDeal(slug);
      if (!result.ok) return textResult(`Could not remove "${slug}": ${result.error}`, true);
      return textResult(
        `✓ Removed "${slug}" from the portal. Its page will 404 and it's off the homepage within ~1 minute ` +
        `(the site is redeploying). It remains in git history if you ever need to restore it.`,
      );
    }
    case 'list_deals': {
      const slugs = await listDeals();
      return textResult(slugs.length ? `Live deals:\n${slugs.map(s => `• ${s}`).join('\n')}` : 'No deals are published yet.');
    }
    case 'get_deal': {
      const deal = await fetchDeal(String(args?.slug ?? ''));
      if (!deal) return textResult(`No deal found with slug "${args?.slug}".`, true);
      return textResult('```json\n' + JSON.stringify(deal, null, 2) + '\n```');
    }
    default:
      throw { code: -32601, message: `Unknown tool: ${name}` };
  }
}

// ── JSON-RPC plumbing ───────────────────────────────────────────────────────
const rpcResult = (id: any, result: any) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id: any, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function handleMessage(msg: any): Promise<any | null> {
  const { id, method, params } = msg ?? {};
  // Notifications have no id → no response.
  if (id === undefined || id === null) return null;

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      const protocolVersion = SUPPORTED_PROTOCOLS.has(requested) ? requested : DEFAULT_PROTOCOL;
      return rpcResult(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      try {
        const result = await callTool(params?.name, params?.arguments ?? {});
        return rpcResult(id, result);
      } catch (err: any) {
        if (err && typeof err.code === 'number') return rpcError(id, err.code, err.message);
        return rpcResult(id, textResult(`Tool error: ${err instanceof Error ? err.message : String(err)}`, true));
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(rpcError(null, -32700, 'Parse error'), 400);
  }

  // Batch or single.
  if (Array.isArray(payload)) {
    const responses = (await Promise.all(payload.map(handleMessage))).filter(Boolean);
    return responses.length ? jsonResponse(responses) : new Response(null, { status: 202 });
  }

  const response = await handleMessage(payload);
  return response ? jsonResponse(response) : new Response(null, { status: 202 });
};

// Stateless server: no SSE stream to open, no session to delete.
export const GET: APIRoute = () =>
  new Response('Fireside Publish MCP server. POST JSON-RPC to this endpoint.', { status: 405 });
