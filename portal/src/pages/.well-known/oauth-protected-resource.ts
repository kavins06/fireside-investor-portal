/**
 * RFC 9728 protected resource metadata, pointing MCP clients at the
 * authorization server for the Fireside Publish connector.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const origin = new URL(request.url).origin;
  return new Response(
    JSON.stringify({
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
