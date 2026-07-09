/**
 * RFC 8414 authorization server metadata for the Fireside Publish connector's
 * minimal OAuth layer. See src/lib/oauth.ts for the design rationale.
 */
import type { APIRoute } from 'astro';
import { originFromRequest } from '../../lib/oauth';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const origin = originFromRequest(request);
  return new Response(
    JSON.stringify({
      issuer: origin,
      authorization_endpoint: `${origin}/api/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['publish'],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
