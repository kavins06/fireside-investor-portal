/**
 * RFC 7591 Dynamic Client Registration. Stateless: the returned `client_id`
 * is a signed token encoding the redirect_uris the client declared, verified
 * again at /authorize and /token. No database, no admin approval step —
 * registration alone grants nothing; the real gate is the access code
 * checked at /authorize.
 */
import type { APIRoute } from 'astro';
import { encodeClientId } from '../../../lib/oauth';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_client_metadata', error_description: 'Body must be JSON' }, 400);
  }

  const redirect_uris = Array.isArray(body?.redirect_uris)
    ? body.redirect_uris.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
    : [];
  if (!redirect_uris.length) {
    return json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' }, 400);
  }

  const client_name = typeof body?.client_name === 'string' ? body.client_name : undefined;
  const iat = Math.floor(Date.now() / 1000);
  const client_id = encodeClientId({ redirect_uris, client_name, iat });

  return json(
    {
      client_id,
      client_id_issued_at: iat,
      redirect_uris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      client_name,
    },
    201,
  );
};
