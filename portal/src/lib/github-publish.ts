/**
 * github-publish — commit a deal record (and optional images) to the portal repo
 * via the GitHub Contents API, which triggers a Vercel auto-deploy.
 *
 * Server-side ONLY. The fine-grained PAT (Contents: Read+write on the repo) is
 * read from env and never leaves the function. Used by the Fireside Publish MCP
 * route (src/pages/api/mcp.ts).
 *
 * Contents API is one-file-per-commit; we make 1–3 sequential commits (deal JSON
 * + up to a couple of images). Each push to the branch yields one current Vercel
 * build — fine for this low-volume publish flow (Git Data API atomic multi-file
 * commits aren't worth the complexity here).
 *
 * Env:
 *   GITHUB_TOKEN   fine-grained PAT, Contents: Read and write on the repo  (required)
 *   GITHUB_REPO    "owner/repo"  (default: kavins06/fireside-investor-portal)
 *   GITHUB_BRANCH  branch to commit to  (default: master)
 *   PUBLIC_SITE_URL  e.g. https://portal-eta-peach.vercel.app  (optional, for the success link)
 */

const API = 'https://api.github.com';

interface ImageFile {
  filename: string;       // e.g. "hero.jpg"
  contentBase64: string;  // raw file bytes, base64-encoded
}

export interface PublishInput {
  slug: string;
  deal: unknown;          // already-validated deal record (object)
  images?: ImageFile[];   // committed to public/assets/deals/<slug>/<filename>
}

export interface PublishResult {
  ok: boolean;
  error?: string;
  commits: { path: string; sha: string }[];
  dealUrl?: string;
}

function env() {
  const token = import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  const repo = import.meta.env.GITHUB_REPO ?? process.env.GITHUB_REPO ?? 'kavins06/fireside-investor-portal';
  const branch = import.meta.env.GITHUB_BRANCH ?? process.env.GITHUB_BRANCH ?? 'master';
  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? '';
  return { token, repo, branch, siteUrl };
}

function headers(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'fireside-portal-publish',
    'Content-Type': 'application/json',
  };
}

// Look up the current blob sha for a path (needed to UPDATE; 404 ⇒ new file).
async function currentSha(repo: string, path: string, branch: string, token: string): Promise<string | undefined> {
  const res = await fetch(`${API}/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`, {
    headers: headers(token),
  });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { sha?: string };
  return data.sha;
}

// Create or update a single file. Retries once on a 409 (stale sha) by re-reading.
async function commitFile(
  repo: string, path: string, contentBase64: string, message: string, branch: string, token: string,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await currentSha(repo, path, branch, token);
    const res = await fetch(`${API}/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({ message, content: contentBase64, branch, ...(sha ? { sha } : {}) }),
    });
    if (res.ok) {
      const data = await res.json() as { commit?: { sha?: string } };
      return data.commit?.sha ?? '';
    }
    if (res.status === 409 && attempt === 0) continue; // stale sha — re-read and retry once
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
  }
  throw new Error(`GitHub PUT ${path} failed after retry`);
}

const toBase64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

/** Commit the deal JSON (+ optional images) to the repo. Triggers a Vercel deploy. */
export async function publishDeal(input: PublishInput): Promise<PublishResult> {
  const { token, repo, branch, siteUrl } = env();
  if (!token) return { ok: false, error: 'Publishing is not configured on the server (missing GITHUB_TOKEN).', commits: [] };

  const { slug } = input;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: `Invalid slug "${slug}" — must be kebab-case.`, commits: [] };
  }

  const commits: { path: string; sha: string }[] = [];
  try {
    // 1) the deal record — pretty-printed with a trailing newline to match the repo
    const dealPath = `portal/src/content/deals/${slug}.json`;
    const dealJson = JSON.stringify(input.deal, null, 2) + '\n';
    const dealSha = await commitFile(repo, dealPath, toBase64(dealJson), `Publish ${slug} deal via Fireside connector`, branch, token);
    commits.push({ path: dealPath, sha: dealSha });

    // 2) images (optional)
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
export async function listDeals(): Promise<string[]> {
  const { token, repo, branch } = env();
  if (!token) throw new Error('Missing GITHUB_TOKEN');
  const res = await fetch(`${API}/repos/${repo}/contents/portal/src/content/deals?ref=${encodeURIComponent(branch)}`, { headers: headers(token) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list deals failed: ${res.status}`);
  const items = await res.json() as { name: string; type: string }[];
  return items.filter(i => i.type === 'file' && i.name.endsWith('.json')).map(i => i.name.replace(/\.json$/, ''));
}

/** Read a deal record from the repo (for edits). Returns null if it doesn't exist. */
export async function fetchDeal(slug: string): Promise<unknown | null> {
  const { token, repo, branch } = env();
  if (!token) throw new Error('Missing GITHUB_TOKEN');
  const path = `portal/src/content/deals/${slug}.json`;
  const res = await fetch(`${API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status}`);
  const data = await res.json() as { content?: string };
  if (!data.content) return null;
  return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
}

/** Remove a deal record from the repo (unpublish). Triggers a Vercel deploy. */
export async function deleteDeal(slug: string): Promise<{ ok: boolean; existed: boolean; error?: string }> {
  const { token, repo, branch } = env();
  if (!token) return { ok: false, existed: false, error: 'Publishing is not configured on the server (missing GITHUB_TOKEN).' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, existed: false, error: `Invalid slug "${slug}".` };

  const path = `portal/src/content/deals/${slug}.json`;
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/');
  try {
    const sha = await currentSha(repo, path, branch, token);
    if (!sha) return { ok: false, existed: false, error: `No deal found with slug "${slug}".` };
    const res = await fetch(`${API}/repos/${repo}/contents/${encoded}`, {
      method: 'DELETE',
      headers: headers(token),
      body: JSON.stringify({ message: `Unpublish ${slug} deal via Fireside connector`, sha, branch }),
    });
    if (!res.ok) return { ok: false, existed: true, error: `GitHub delete failed: ${res.status} ${await res.text()}` };
    return { ok: true, existed: true };
    // ponytail: deletes the deal record (page 404s, off the homepage). Any images under
    // public/assets/deals/<slug>/ are left as harmless orphans — add cleanup if it matters.
  } catch (err) {
    return { ok: false, existed: true, error: err instanceof Error ? err.message : String(err) };
  }
}
