/**
 * Minimal OAuth 2.1 + Dynamic Client Registration (RFC 7591) layer in front of
 * the Fireside Publish connector, for clients (claude.ai's Connectors UI) that
 * require an OAuth flow and won't accept a static `Authorization` header the
 * way Claude Code's `.mcp.json` does.
 *
 * Design: there's exactly one real credential — the same `MCP_PUBLISH_TOKEN`
 * that has always gated `/api/mcp` — so this layer doesn't add a second
 * secret store. It wraps that token in a standards-shaped handshake:
 *   register  → mint a signed, stateless "client_id" that encodes the
 *               client's declared redirect_uris (no DB needed on Vercel).
 *   authorize → a plain HTML form asking for the Fireside access code
 *               (the same MCP_PUBLISH_TOKEN value). Correct code → a
 *               short-lived signed authorization code.
 *   token     → exchanges the code (+ PKCE verifier) for an access_token
 *               that IS `MCP_PUBLISH_TOKEN` — so `/api/mcp`'s existing
 *               Bearer check needs no changes at all.
 *
 * Everything is HMAC-signed and stateless (no database): the "client_id" and
 * "code" values carry their own payload + signature, verified against
 * OAUTH_SIGNING_SECRET. This is safe because the only thing an attacker could
 * forge without the secret is a redirect target they already control — they
 * still can't get an access_token without the real Fireside access code.
 */
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const CODE_TTL_SECONDS = 5 * 60; // authorization codes are single-use and short-lived

function signingSecret(): string {
  return import.meta.env.OAUTH_SIGNING_SECRET ?? process.env.OAUTH_SIGNING_SECRET ?? '';
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function hmac(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Sign an arbitrary JSON-serializable payload into a self-verifying token string. */
export function signPayload(payload: Record<string, unknown>): string {
  const secret = signingSecret();
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body, secret)}`;
}

/** Verify + decode a token produced by signPayload(). Returns null if invalid, unsigned, or tampered. */
export function verifyPayload<T = Record<string, unknown>>(token: string): T | null {
  const secret = signingSecret();
  if (!secret || !token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  if (!constantTimeEqual(hmac(body, secret), mac)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export interface RegisteredClient {
  redirect_uris: string[];
  client_name?: string;
  iat: number;
}

export function encodeClientId(client: RegisteredClient): string {
  return signPayload(client as unknown as Record<string, unknown>);
}

export function decodeClientId(clientId: string): RegisteredClient | null {
  return verifyPayload<RegisteredClient>(clientId);
}

export interface AuthCodePayload {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  exp: number; // unix seconds
}

export function issueAuthCode(payload: Omit<AuthCodePayload, 'exp'>): string {
  return signPayload({ ...payload, exp: Math.floor(Date.now() / 1000) + CODE_TTL_SECONDS });
}

export function verifyAuthCode(code: string): AuthCodePayload | null {
  const decoded = verifyPayload<AuthCodePayload>(code);
  if (!decoded) return null;
  if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return decoded;
}

/** RFC 7636 PKCE — S256 only (Claude Code / claude.ai always use S256). */
export function pkceMatches(codeVerifier: string, codeChallenge: string): boolean {
  const computed = b64url(createHash('sha256').update(codeVerifier).digest());
  return constantTimeEqual(computed, codeChallenge);
}

export function expectedAccessCode(): string {
  return import.meta.env.MCP_PUBLISH_TOKEN ?? process.env.MCP_PUBLISH_TOKEN ?? '';
}

export function accessCodeMatches(provided: string): boolean {
  const expected = expectedAccessCode();
  if (!expected || !provided) return false;
  return constantTimeEqual(provided, expected);
}
