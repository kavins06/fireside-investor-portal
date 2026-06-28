#!/usr/bin/env node
/**
 * fireside.mjs — the Fireside Publish CLI. Self-contained replacement for the old
 * MCP connector: validate / publish / get / list / unpublish, all going straight
 * to the GitHub Contents API with the token embedded in ../config.json.
 *
 * Usage (Claude runs these for the publisher; the human just chats):
 *   node fireside.mjs validate  <deal.json | ->
 *   node fireside.mjs publish   <deal.json | ->  [--image <path>]...
 *   node fireside.mjs get       <slug>            # prints the deal JSON to edit
 *   node fireside.mjs list
 *   node fireside.mjs unpublish <slug>
 *
 * `-` reads the deal JSON from stdin. Exit 0 = ok, 1 = error/blocked, 2 = usage.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { validateDeal } from './validate.mjs';
import { publishDeal, listDeals, fetchDeal, deleteDeal } from './github.mjs';

class CliError extends Error { constructor(message, code = 1) { super(message); this.code = code; } }

function readDeal(arg) {
  if (!arg) throw new CliError('Provide a deal JSON file path (or - for stdin).', 2);
  const raw = arg === '-' ? readFileSync(0, 'utf8') : readFileSync(arg, 'utf8');
  return JSON.parse(raw);
}

// Identical to the old MCP connector's report, so output a publisher sees is unchanged.
function reportText(name, v) {
  const lines = [];
  if (v.computed) {
    const c = v.computed;
    lines.push(`${name} — base case (cap 6.25%, 7-yr hold):`);
    lines.push(`  Deal IRR ${(c.dealIRR * 100).toFixed(1)}%   MOIC ${c.mult.toFixed(2)}×   Avg CoC ${(c.avgCoC * 100).toFixed(1)}%`);
    lines.push(`  LP IRR ${(c.lpIRR * 100).toFixed(1)}%   LP MOIC ${c.lpMult.toFixed(2)}×`);
  }
  for (const w of v.warnings) lines.push(`⚠ ${w}`);
  for (const e of v.errors) lines.push(`✗ ${e}`);
  lines.push(v.ok ? '✓ Deal record is sound.' : `✗ ${v.errors.length} error(s) — fix these before publishing.`);
  return lines.join('\n');
}

const [cmd, ...rest] = process.argv.slice(2);

// Set process.exitCode and let Node drain handles, rather than process.exit() which
// can race undici socket teardown and trip a libuv assertion on Windows.
const main = async () => {
  switch (cmd) {
    case 'validate': {
      const deal = readDeal(rest[0]);
      const v = validateDeal(deal);
      console.log(reportText(deal?.name ?? '(deal)', v));
      process.exitCode = v.ok ? 0 : 1;
      return;
    }
    case 'publish': {
      const images = [], args = [];
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--image') {
          const p = rest[++i];
          if (!p) throw new CliError('--image needs a file path', 2);
          images.push({ filename: basename(p), contentBase64: readFileSync(p).toString('base64') });
        } else args.push(rest[i]);
      }
      const deal = readDeal(args[0]);
      const v = validateDeal(deal);
      if (!v.ok) {
        console.log('Publish blocked — the deal did not pass validation:\n\n' + reportText(deal?.name ?? '(deal)', v));
        process.exitCode = 1;
        return;
      }
      const result = await publishDeal({ slug: deal.slug, deal, images });
      if (!result.ok) throw new CliError(`Publish failed: ${result.error}`);
      const warnLine = v.warnings.length ? `\n\nNote:\n${v.warnings.map(w => `⚠ ${w}`).join('\n')}` : '';
      console.log(
        `✓ Published "${deal.name}". It will be live at ${result.dealUrl} within ~1 minute (the site is redeploying).` +
        `\nCommitted ${result.commits.length} file(s).${warnLine}`,
      );
      return;
    }
    case 'unpublish': {
      const slug = String(rest[0] ?? '');
      const result = await deleteDeal(slug);
      if (!result.ok) throw new CliError(`Could not remove "${slug}": ${result.error}`);
      console.log(
        `✓ Removed "${slug}" from the portal. Its page will 404 and it's off the homepage within ~1 minute ` +
        `(the site is redeploying). It remains in git history if you ever need to restore it.`,
      );
      return;
    }
    case 'list': {
      const slugs = await listDeals();
      console.log(slugs.length ? `Live deals:\n${slugs.map(s => `• ${s}`).join('\n')}` : 'No deals are published yet.');
      return;
    }
    case 'get': {
      const deal = await fetchDeal(String(rest[0] ?? ''));
      if (!deal) throw new CliError(`No deal found with slug "${rest[0]}".`);
      console.log(JSON.stringify(deal, null, 2));
      return;
    }
    default:
      console.error('usage: node fireside.mjs <validate|publish|get|list|unpublish> [args]\n' +
        '  validate  <deal.json|->\n  publish   <deal.json|-> [--image <path>]...\n  get <slug>\n  list\n  unpublish <slug>');
      process.exitCode = 2;
  }
};

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = err instanceof CliError ? err.code : 1;
});
