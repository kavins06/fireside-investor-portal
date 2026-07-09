/**
 * Authorization endpoint. This is the one interactive step in the whole
 * flow: the person adding the connector types the Fireside access code
 * once. Everything else (register, token) is machine-to-machine.
 */
import type { APIRoute } from 'astro';
import { decodeClientId, issueAuthCode, accessCodeMatches } from '../../../lib/oauth';

export const prerender = false;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function page(opts: { clientName?: string; error?: string; hidden: Record<string, string> }): string {
  const hiddenInputs = Object.entries(opts.hidden)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Fireside Publish</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b1220; color: #e9e4d8;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #131c2e; border: 1px solid #2a3550; border-radius: 12px; padding: 2.5rem; max-width: 380px; width: 90%; }
  h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #f2e8cf; }
  p { color: #a9b2c9; font-size: 0.9rem; line-height: 1.5; }
  label { display: block; margin: 1.25rem 0 0.4rem; font-size: 0.85rem; color: #cdd4e6; }
  input[type="password"] { width: 100%; box-sizing: border-box; padding: 0.65rem 0.75rem; border-radius: 8px;
         border: 1px solid #37456b; background: #0f1626; color: #e9e4d8; font-size: 1rem; }
  button { margin-top: 1.5rem; width: 100%; padding: 0.7rem; border-radius: 8px; border: none;
         background: #c9a24b; color: #0b1220; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
  .error { color: #e5877e; font-size: 0.85rem; margin-top: 0.75rem; }
</style>
</head>
<body>
  <div class="card">
    <h1>Connect Fireside Publish${opts.clientName ? ` for ${escapeHtml(opts.clientName)}` : ''}</h1>
    <p>Enter the Fireside access code your admin gave you. This is a one-time step per device.</p>
    <form method="POST">
      ${hiddenInputs}
      <label for="access_code">Access code</label>
      <input type="password" id="access_code" name="access_code" autofocus autocomplete="off">
      ${opts.error ? `<div class="error">${escapeHtml(opts.error)}</div>` : ''}
      <button type="submit">Connect</button>
    </form>
  </div>
</body>
</html>`;
}

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

interface AuthParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
}

function readAuthParams(get: (key: string) => string | null): AuthParams {
  return {
    response_type: get('response_type') ?? '',
    client_id: get('client_id') ?? '',
    redirect_uri: get('redirect_uri') ?? '',
    state: get('state') ?? '',
    code_challenge: get('code_challenge') ?? '',
    code_challenge_method: get('code_challenge_method') ?? '',
  };
}

function validate(params: AuthParams): { ok: true; clientName?: string } | { ok: false; message: string } {
  if (params.response_type !== 'code') return { ok: false, message: 'Unsupported response_type (expected "code").' };
  if (params.code_challenge_method !== 'S256') return { ok: false, message: 'This connector requires PKCE (S256).' };
  if (!params.code_challenge) return { ok: false, message: 'Missing code_challenge.' };
  const client = decodeClientId(params.client_id);
  if (!client) return { ok: false, message: 'Unknown or expired client_id — try re-adding the connector.' };
  if (!client.redirect_uris.includes(params.redirect_uri)) {
    return { ok: false, message: 'redirect_uri does not match what was registered.' };
  }
  return { ok: true, clientName: client.client_name };
}

export const GET: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  const params = readAuthParams((key) => url.searchParams.get(key));
  const validation = validate(params);
  if (!validation.ok) return html(`<p>${escapeHtml(validation.message)}</p>`, 400);

  return html(
    page({
      clientName: validation.clientName,
      hidden: {
        response_type: params.response_type,
        client_id: params.client_id,
        redirect_uri: params.redirect_uri,
        state: params.state,
        code_challenge: params.code_challenge,
        code_challenge_method: params.code_challenge_method,
      },
    }),
  );
};

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const params = readAuthParams((key) => {
    const v = form.get(key);
    return typeof v === 'string' ? v : null;
  });
  const validation = validate(params);
  if (!validation.ok) return html(`<p>${escapeHtml(validation.message)}</p>`, 400);

  const accessCode = String(form.get('access_code') ?? '');
  if (!accessCodeMatches(accessCode)) {
    return html(
      page({
        clientName: validation.clientName,
        error: 'That code is not correct. Ask your admin for the current Fireside access code.',
        hidden: {
          response_type: params.response_type,
          client_id: params.client_id,
          redirect_uri: params.redirect_uri,
          state: params.state,
          code_challenge: params.code_challenge,
          code_challenge_method: params.code_challenge_method,
        },
      }),
      401,
    );
  }

  const code = issueAuthCode({
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    code_challenge: params.code_challenge,
  });

  const redirect = new URL(params.redirect_uri);
  redirect.searchParams.set('code', code);
  if (params.state) redirect.searchParams.set('state', params.state);
  return new Response(null, { status: 302, headers: { Location: redirect.toString() } });
};
