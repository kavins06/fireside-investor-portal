/**
 * validateDeal — the single check a deal record must pass before it goes live.
 *
 * Two layers the Astro build can't fully give you on its own:
 *   1. Shape (zod, from deal-schema.mjs) — with friendly, field-pathed messages.
 *   2. Soundness (the real engine) — equal arrays, finite IRR, DSCR, a teaser
 *      headline that actually matches the model.
 *
 * Returns a structured result so callers (CLI, MCP connector) can render plain
 * English for a non-technical user:
 *   { ok, errors: string[], warnings: string[], computed: {...} | null }
 *
 * Pure + dependency-light (zod + engine.js). No I/O — callers load the JSON.
 */
import { run } from './engine.js';
import { dealSchema } from './deal-schema.mjs';

// ModelIsland opens the interactive model at these base levers (cap 6.25%,
// 7-yr hold, no rent/exp delta, occ = baseOcc). Validate against the same.
const BASE_HOLD = 7;

export function validateDeal(deal) {
  const errors = [];
  const warnings = [];

  // ── Layer 1: shape ─────────────────────────────────────────────────────────
  const parsed = dealSchema.safeParse(deal);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const where = issue.path.length ? issue.path.join('.') : '(root)';
      errors.push(`${where}: ${issue.message}`);
    }
    // Shape is broken — engine checks would just throw noise. Stop here.
    return { ok: false, errors, warnings, computed: null };
  }

  const e = parsed.data.engine;

  // ── Layer 1b: decimals-not-percents (shape-valid but likely a unit slip) ────
  for (const k of ['rate', 'pref', 'promote', 'assetMgmt', 'sellCost', 'baseOcc']) {
    if (e[k] > 1.5) warnings.push(`engine.${k} = ${e[k]} looks like a percent — the engine expects a decimal (e.g. 0.0525 for 5.25%)`);
  }
  if (Math.abs(e.lpShare + e.gpShare - 1) > 1e-6) {
    errors.push(`engine.lpShare (${e.lpShare}) + engine.gpShare (${e.gpShare}) must sum to 1`);
  }

  // ── Layer 2: run the real model and sanity-check ────────────────────────────
  let computed = null;
  if (errors.length === 0) {
    let r;
    try {
      r = run({ cap: 0.0625, rent: 0, occ: e.baseOcc, exp: 0, hold: BASE_HOLD }, e);
    } catch (err) {
      errors.push(`the finance engine threw while running this deal: ${err.message}`);
    }

    if (r) {
      if (r.dealIRR === null || !Number.isFinite(r.dealIRR)) errors.push('deal IRR did not converge (got null/NaN) — check the cash-flow arrays and capital structure');
      if (!Number.isFinite(r.mult) || r.mult <= 0) errors.push(`equity multiple is not positive (${r.mult}) — distributions or equity are wrong`);
      if (!Number.isFinite(r.lpIRR ?? NaN)) errors.push('LP IRR did not converge — check the waterfall inputs (pref / promote / splits)');

      if (errors.length === 0) {
        const minDSCR = Math.min(...r.rows.slice(0, r.Y).map(x => x.dscr));
        if (minDSCR < 1.2) warnings.push(`minimum operating-year DSCR is ${minDSCR.toFixed(2)} (below 1.20) — debt may be undersized vs. NOI`);

        if (e.baseNOI.length < BASE_HOLD + 1) {
          const extrapFrom = e.baseNOI.length + 1;
          warnings.push(`baseNOI provides ${e.baseNOI.length} years; the model holds 7 and reads year-8 NOI at exit, so year${extrapFrom === 8 ? ' 8 is' : `s ${extrapFrom}–8 are`} extrapolated (~2.6%/yr). Provide the full pro-forma horizon if you have it.`);
        }

        // Teaser must not lie — derive it from the model.
        const t = parsed.data.teaser;
        const tIRR = parseFloat(String(t.targetIRR).replace(/[^\d.]/g, ''));
        const tMult = parseFloat(String(t.equityMultiple).replace(/[^\d.]/g, ''));
        if (Number.isFinite(tIRR) && Math.abs(tIRR - r.lpIRR * 100) > 4)
          warnings.push(`teaser.targetIRR "${t.targetIRR}" vs. model LP IRR ${(r.lpIRR * 100).toFixed(1)}% — off by more than 4 points; re-derive the headline from the model`);
        if (Number.isFinite(tMult) && Math.abs(tMult - r.lpMult) > 0.3)
          warnings.push(`teaser.equityMultiple "${t.equityMultiple}" vs. model LP multiple ${r.lpMult.toFixed(2)}× — off by more than 0.3×; re-derive the headline from the model`);
        if (t.holdYears !== BASE_HOLD)
          warnings.push(`teaser.holdYears is ${t.holdYears}, but the interactive model opens at a 7-year hold (slider moves 3–10) — the headline hold and the model default differ`);

        computed = {
          dealIRR: r.dealIRR, mult: r.mult, avgCoC: r.avgCoC,
          lpIRR: r.lpIRR, lpMult: r.lpMult, gpIRR: r.gpIRR, gpMult: r.gpMult,
          minDSCR,
        };
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, computed };
}
