import type { APIRoute } from 'astro';

// POST /api/unlock
// Body: { email: string, deal_slug: string }
// Records a lead in Supabase and returns 200 on success.
// The Supabase service key is ONLY used here (server-side, never exposed to client).

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string; deal_slug?: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const email    = (body.email    ?? '').trim().toLowerCase();
  const dealSlug = (body.deal_slug ?? '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'A valid email address is required.' }, 422);
  }
  if (!dealSlug) {
    return json({ error: 'deal_slug is required.' }, 422);
  }

  // ── Supabase insert ────────────────────────────────────────────────────────
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  // Server-side only — anon key with insert-only RLS on the leads table.
  // The service role key is never needed here; anon INSERT policy is sufficient.
  const anonKey = import.meta.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    // Supabase not yet wired — allow unlock for dev/preview without backend
    console.warn('[unlock] SUPABASE_URL or SUPABASE_ANON_KEY not set — skipping lead insert.');
    return json({ ok: true });
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':         anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Prefer':         'return=minimal',
      },
      body: JSON.stringify({
        email,
        deal_slug: dealSlug,
        // captured_at is set by Supabase DEFAULT now()
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[unlock] Supabase insert failed:', res.status, text);
      // Still unlock — don't block the prospect because of a backend issue
    }
  } catch (err) {
    console.error('[unlock] Supabase fetch error:', err);
    // Still unlock
  }

  return json({ ok: true });
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
