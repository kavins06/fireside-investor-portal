#!/usr/bin/env node
/**
 * validate-deal — sanity-check a portal deal record against the real engine.
 *
 * `npm run build` validates the JSON *shape* (Astro content schema), but it
 * cannot tell whether the numbers are sound. This does: it runs the same
 * finance engine the live model uses and asserts the deal isn't quietly broken
 * — mismatched cash-flow arrays (which the engine zips into NaN), an IRR that
 * won't converge, sub-1.2 DSCR, or a teaser headline that contradicts the model.
 *
 * Usage (from portal/):
 *   node tools/validate-deal.mjs four-seasons
 *   node tools/validate-deal.mjs src/content/deals/four-seasons.json
 *   npm run validate-deal -- four-seasons
 *
 * Exit code 1 on any hard failure; warnings print but don't fail the build.
 *
 * ponytail: this IS the check the schema can't do — keep it, it's the one thing
 * standing between a GP-authored deal and a NaN dashboard in front of an investor.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';
import { run } from '../src/lib/engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];

if (!arg) {
  console.error('usage: node tools/validate-deal.mjs <slug | path-to-deal.json>');
  process.exit(2);
}

// Resolve <slug> → src/content/deals/<slug>.json, or accept an explicit path.
const path = arg.endsWith('.json')
  ? (isAbsolute(arg) ? arg : resolve(process.cwd(), arg))
  : resolve(__dirname, '..', 'src', 'content', 'deals', `${arg}.json`);

if (!existsSync(path)) {
  console.error(`✗ deal not found: ${path}`);
  process.exit(1);
}

const deal = JSON.parse(readFileSync(path, 'utf8'));
const errors = [];
const warns = [];
const fail = m => errors.push(m);
const warn = m => warns.push(m);

// ── Structural / engine-contract checks the schema doesn't enforce ───────────
const e = deal.engine ?? {};
const { baseNOI, baseOpex } = e;

if (!Array.isArray(baseNOI) || !Array.isArray(baseOpex)) {
  fail('engine.baseNOI and engine.baseOpex must both be arrays');
} else {
  if (baseNOI.length !== baseOpex.length)
    fail(`baseNOI (${baseNOI.length}) and baseOpex (${baseOpex.length}) must be the same length — the engine zips them index-by-index, a mismatch produces NaN`);
  if (baseNOI.length === 0) fail('baseNOI/baseOpex must have at least one year');
  if (baseNOI.some(n => typeof n !== 'number' || !isFinite(n))) fail('baseNOI has a non-finite value');
  if (baseOpex.some(n => typeof n !== 'number' || !isFinite(n))) fail('baseOpex has a non-finite value');
}

// Decimals, not percentages: rate/pref/promote/assetMgmt/sellCost are fractions.
for (const k of ['rate', 'pref', 'promote', 'assetMgmt', 'sellCost', 'baseOcc']) {
  const v = e[k];
  if (typeof v !== 'number') { fail(`engine.${k} is required and must be a number`); continue; }
  if (v > 1.5) warn(`engine.${k} = ${v} looks like a percent — the engine expects a decimal (e.g. 0.0525 for 5.25%)`);
}

if (typeof e.lpShare === 'number' && typeof e.gpShare === 'number') {
  if (Math.abs(e.lpShare + e.gpShare - 1) > 1e-6)
    fail(`lpShare (${e.lpShare}) + gpShare (${e.gpShare}) must sum to 1`);
}

// ── Run the real model at the portal's base levers and sanity-check outputs ──
// ModelIsland opens at cap 6.25%, hold 7, no rent/exp delta, occ = baseOcc.
const HOLD = 7; // ModelIsland's hardcoded slider default; teaser.holdYears is copy only.
let r;
if (errors.length === 0) {
  try {
    r = run({ cap: 0.0625, rent: 0, occ: e.baseOcc, exp: 0, hold: HOLD }, e);
  } catch (err) {
    fail(`engine.run() threw: ${err.message}`);
  }
}

if (r) {
  if (r.dealIRR === null || !isFinite(r.dealIRR)) fail('deal IRR did not converge (null/NaN) — check the cash-flow arrays and capital structure');
  if (!isFinite(r.mult) || r.mult <= 0) fail(`equity multiple is not positive (${r.mult}) — distributions or equity are wrong`);
  if (!isFinite(r.lpIRR ?? NaN)) fail('LP IRR did not converge — check the waterfall inputs (pref/promote/splits)');

  const minDSCR = Math.min(...r.rows.slice(0, r.Y).map(x => x.dscr));
  if (minDSCR < 1.2) warn(`min operating-year DSCR is ${minDSCR.toFixed(2)} (< 1.20) — debt may be undersized vs. NOI`);

  if (baseNOI && baseNOI.length < HOLD + 1)
    warn(`baseNOI has ${baseNOI.length} years; the model holds 7 (exit reads year 8 NOI), so years ${baseNOI.length + 1}–8 are extrapolated at ~2.6%/yr. Provide the full pro-forma horizon if you have it.`);

  // Teaser vs. computed — the headline must not lie.
  const tIRR = parseFloat(String(deal.teaser?.targetIRR ?? '').replace(/[^\d.]/g, ''));
  const tMult = parseFloat(String(deal.teaser?.equityMultiple ?? '').replace(/[^\d.]/g, ''));
  if (isFinite(tIRR) && Math.abs(tIRR - r.lpIRR * 100) > 4)
    warn(`teaser.targetIRR "${deal.teaser.targetIRR}" vs. model LP IRR ${(r.lpIRR * 100).toFixed(1)}% — off by >4 pts; re-derive the headline from the model`);
  if (isFinite(tMult) && Math.abs(tMult - r.lpMult) > 0.3)
    warn(`teaser.equityMultiple "${deal.teaser.equityMultiple}" vs. model LP multiple ${r.lpMult.toFixed(2)}× — off by >0.3×; re-derive the headline from the model`);
  if (deal.teaser && deal.teaser.holdYears !== HOLD)
    warn(`teaser.holdYears is ${deal.teaser.holdYears} but the interactive model opens at a 7-year hold (slider moves 3–10). The headline hold and the model's default differ.`);
}

// ── Report ───────────────────────────────────────────────────────────────────
const name = deal.name ?? '(unnamed)';
if (r) {
  console.log(`\n  ${name} — base case (cap 6.25%, ${HOLD}-yr hold):`);
  console.log(`    Deal IRR ${(r.dealIRR * 100).toFixed(1)}%   MOIC ${r.mult.toFixed(2)}×   Avg CoC ${(r.avgCoC * 100).toFixed(1)}%`);
  console.log(`    LP  IRR ${(r.lpIRR * 100).toFixed(1)}%   LP MOIC ${r.lpMult.toFixed(2)}×`);
}
for (const w of warns) console.log(`  ⚠ ${w}`);
if (errors.length) {
  for (const m of errors) console.error(`  ✗ ${m}`);
  console.error(`\n✗ ${name}: ${errors.length} error(s)\n`);
  process.exit(1);
}
console.log(`\n✓ ${name}: deal record is sound${warns.length ? ` (${warns.length} warning(s))` : ''}\n`);
