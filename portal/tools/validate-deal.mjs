#!/usr/bin/env node
/**
 * validate-deal — CLI wrapper around the shared deal validator.
 *
 * The actual checks live in src/lib/deal-validation.mjs (shared with the publish
 * connector, so the GP's CLI and a non-tech Cowork publish see identical results).
 * This file is just I/O: resolve a slug/path, run validateDeal, print, set exit code.
 *
 * Usage (from portal/):
 *   node tools/validate-deal.mjs four-seasons
 *   node tools/validate-deal.mjs src/content/deals/four-seasons.json
 *   npm run validate-deal -- four-seasons
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';
import { validateDeal } from '../src/lib/deal-validation.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];

if (!arg) {
  console.error('usage: node tools/validate-deal.mjs <slug | path-to-deal.json>');
  process.exit(2);
}

const path = arg.endsWith('.json')
  ? (isAbsolute(arg) ? arg : resolve(process.cwd(), arg))
  : resolve(__dirname, '..', 'src', 'content', 'deals', `${arg}.json`);

if (!existsSync(path)) {
  console.error(`✗ deal not found: ${path}`);
  process.exit(1);
}

let deal;
try {
  deal = JSON.parse(readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`✗ ${path} is not valid JSON: ${err.message}`);
  process.exit(1);
}

const name = deal?.name ?? '(unnamed)';
const { ok, errors, warnings, computed } = validateDeal(deal);

if (computed) {
  console.log(`\n  ${name} — base case (cap 6.25%, 7-yr hold):`);
  console.log(`    Deal IRR ${(computed.dealIRR * 100).toFixed(1)}%   MOIC ${computed.mult.toFixed(2)}×   Avg CoC ${(computed.avgCoC * 100).toFixed(1)}%`);
  console.log(`    LP  IRR ${(computed.lpIRR * 100).toFixed(1)}%   LP MOIC ${computed.lpMult.toFixed(2)}×`);
}
for (const w of warnings) console.log(`  ⚠ ${w}`);
if (!ok) {
  for (const m of errors) console.error(`  ✗ ${m}`);
  console.error(`\n✗ ${name}: ${errors.length} error(s)\n`);
  process.exit(1);
}
console.log(`\n✓ ${name}: deal record is sound${warnings.length ? ` (${warnings.length} warning(s))` : ''}\n`);
