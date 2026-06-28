/**
 * github.mjs — commit a deal record (and optional images) to the portal repo via
 * the GitHub Contents API, which triggers a Vercel auto-deploy. Plain-Node port
 * of the portal's src/lib/github-publish.ts.
 *
 * The write-capable GitHub token is read from the plugin's config.json
 * (../config.json), with env vars taking precedence if set. Contents API is
 * one-file-per-commit; 1–3 sequential commits (deal JSON + up to a couple of
 * images), each yielding one current Vercel build — fine for low-volume publish.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = 'https://api.github.com';
const __dirname = dirname(fileURLToPath(import.meta.url));

export function config() {
  let cfg = {};
  try { cfg = JSON.parse(readFileSync(join(__dirname, '..', 'config.json'), 'utf8')); } catch { /* env-only is fine */ }
  return {
    token:   process.env.GITHUB_TOKEN   || cfg.githubToken || '',
    repo:    process.env.GITHUB_REPO    || cfg.repo        || 'kavins06/fireside-investor-portal',
    branch:  process.env.GITHUB_BRANCH  || cfg.branch      || 'master',
    siteUrl: process.env.PUBLIC_SITE_URL || cfg.siteUrl    || '',
  };
}

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'fireside-portal-publish',
    'Content-Type': 'application/json',
  };
}

const encodePath = p => encodeURIComponent(p).replace(/%2F/g, '/');
const toBase64 = s => Buffer.from(s, 'utf8').toString('base64');
// Consume/cancel a response body we're not going to read, so the keep-alive socket
// is released and the process can exit cleanly (Windows libuv asserts otherwise).
const drain = res => res.body?.cancel?.().catch(() => {});

// Look up the current blob sha for a path (needed to UPDATE; 404 ⇒ new file).
async function currentSha(repo, path, branch, token) {
  const res = await fetch(`${API}/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, { headers: headers(token) });
  if (res.status === 404) { await drain(res); return undefined; }
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.sha;
}

// Create or update a single file. Retries once on a 409 (stale sha) by re-reading.
async function commitFile(repo, path, contentBase64, message, branch, token) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await currentSha(repo, path, branch, token);
    const res = await fetch(`${API}/repos/${repo}/contents/${encodePath(path)}`, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({ message, content: contentBase64, branch, ...(sha ? { sha } : {}) }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.commit?.sha ?? '';
    }
    if (res.status === 409 && attempt === 0) { await drain(res); continue; } // stale sha — re-read and retry once
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
  }
  throw new Error(`GitHub PUT ${path} failed after retry`);
}

/** Commit the deal JSON (+ optional images) to the repo. Triggers a Vercel deploy.
 *  input: { slug, deal, images?: [{ filename, contentBase64 }] } */
export async function publishDeal(input) {
  const { token, repo, branch, siteUrl } = config();
  if (!token) return { ok: false, error: 'No GitHub token in the plugin config.json (githubToken) or GITHUB_TOKEN env.', commits: [] };

  const { slug } = input;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: `Invalid slug "${slug}" — must be kebab-case.`, commits: [] };
  }

  const commits = [];
  try {
    const dealPath = `portal/src/content/deals/${slug}.json`;
    const dealJson = JSON.stringify(input.deal, null, 2) + '\n';
    const dealSha = await commitFile(repo, dealPath, toBase64(dealJson), `Publish ${slug} deal via Fireside plugin`, branch, token);
    commits.push({ path: dealPath, sha: dealSha });

    for (const img of input.images ?? []) {
      const safe = img.filename.replace(/[^a-zA-Z0-9._-]/g, '');
      const imgPath = `portal/public/assets/deals/${slug}/${safe}`;
      const imgSha = await commitFile(repo, imgPath, img.contentBase64, `Add image ${safe} for ${slug}`, branch, token);
      commits.push({ path: imgPath, sha: imgSha });
    }

    const dealUrl = siteUrl ? `${siteUrl.replace(/\/$/, '')}/deals/${slug}` : `/deals/${slug}`;
    return { ok: true, commits, dealUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), commits };
  }
}

/** List the slugs of deals currently in the repo. */
export async function listDeals() {
  const { token, repo, branch } = config();
  if (!token) throw new Error('No GitHub token in config.json or GITHUB_TOKEN env.');
  const res = await fetch(`${API}/repos/${repo}/contents/portal/src/content/deals?ref=${encodeURIComponent(branch)}`, { headers: headers(token) });
  if (res.status === 404) { await drain(res); return []; }
  if (!res.ok) throw new Error(`GitHub list deals failed: ${res.status} ${await res.text().catch(() => '')}`.trim());
  const items = await res.json();
  return items.filter(i => i.type === 'file' && i.name.endsWith('.json')).map(i => i.name.replace(/\.json$/, ''));
}

/** Read a deal record from the repo (for edits). Returns null if it doesn't exist. */
export async function fetchDeal(slug) {
  const { token, repo, branch } = config();
  if (!token) throw new Error('No GitHub token in config.json or GITHUB_TOKEN env.');
  const path = `portal/src/content/deals/${slug}.json`;
  const res = await fetch(`${API}/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, { headers: headers(token) });
  if (res.status === 404) { await drain(res); return null; }
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text().catch(() => '')}`.trim());
  const data = await res.json();
  if (!data.content) return null;
  return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
}

/** Remove a deal record from the repo (unpublish). Triggers a Vercel deploy. */
export async function deleteDeal(slug) {
  const { token, repo, branch } = config();
  if (!token) return { ok: false, existed: false, error: 'No GitHub token in config.json or GITHUB_TOKEN env.' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, existed: false, error: `Invalid slug "${slug}".` };

  const path = `portal/src/content/deals/${slug}.json`;
  try {
    const sha = await currentSha(repo, path, branch, token);
    if (!sha) return { ok: false, existed: false, error: `No deal found with slug "${slug}".` };
    const res = await fetch(`${API}/repos/${repo}/contents/${encodePath(path)}`, {
      method: 'DELETE',
      headers: headers(token),
      body: JSON.stringify({ message: `Unpublish ${slug} deal via Fireside plugin`, sha, branch }),
    });
    if (!res.ok) return { ok: false, existed: true, error: `GitHub delete failed: ${res.status} ${await res.text()}` };
    await drain(res);
    return { ok: true, existed: true };
    // ponytail: deletes the deal record (page 404s, off the homepage). Images under
    // public/assets/deals/<slug>/ are left as harmless orphans — add cleanup if it matters.
  } catch (err) {
    return { ok: false, existed: true, error: err instanceof Error ? err.message : String(err) };
  }
}
