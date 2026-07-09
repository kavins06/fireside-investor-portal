/**
 * Path-suffixed variant of RFC 9728 protected resource metadata
 * (some MCP clients look up `/.well-known/oauth-protected-resource<resource-path>`
 * rather than the bare `/.well-known/oauth-protected-resource`). Same payload.
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
