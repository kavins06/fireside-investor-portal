/**
 * RFC 9728 protected resource metadata, pointing MCP clients at the
 * authorization server for the Fireside Publish connector.
 */
import type { APIRoute } from 'astro';
import { originFromRequest } from '../../lib/oauth';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const origin = originFromRequest(request);
  return new Response(
    JSON.stringify({
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
