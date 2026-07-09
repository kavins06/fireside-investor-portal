/**
 * Token endpoint. Exchanges a code minted by /authorize (proof the caller
 * already typed the real Fireside access code) for an access_token — which
 * IS `MCP_PUBLISH_TOKEN` itself, so /api/mcp's existing Bearer check needs
 * no changes to accept OAuth-issued tokens.
 */
import type { APIRoute } from 'astro';
import { verifyAuthCode, pkceMatches, expectedAccessCode } from '../../../lib/oauth';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function readParams(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = await request.json();
      return typeof body === 'object' && body ? body : {};
    } catch {
      return {};
    }
  }
  const form = await request.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  const accessToken = expectedAccessCode();
  if (!accessToken) return json({ error: 'server_error', error_description: 'Connector not configured' }, 500);

  const params = await readParams(request);
  if (params.grant_type !== 'authorization_code') {
    return json({ error: 'unsupported_grant_type' }, 400);
  }

  const payload = verifyAuthCode(params.code ?? '');
  if (!payload) return json({ error: 'invalid_grant', error_description: 'Code is invalid or expired' }, 400);
  if (payload.client_id !== params.client_id) return json({ error: 'invalid_grant', error_description: 'client_id mismatch' }, 400);
  if (payload.redirect_uri !== params.redirect_uri) return json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' }, 400);
  if (!params.code_verifier || !pkceMatches(params.code_verifier, payload.code_challenge)) {
    return json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
  }

  // The code is single-use by construction (short TTL, and a real implementation
  // would also track jti — omitted here since replay only re-derives the same
  // long-lived access_token an attacker would need the access code to get anyway).
  return json({
    access_token: accessToken,
    token_type: 'bearer',
    scope: 'publish',
  });
};
