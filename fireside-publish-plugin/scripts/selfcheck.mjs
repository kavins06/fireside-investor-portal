#!/usr/bin/env node
/**
 * selfcheck.mjs — fast offline check that the bundled validator + engine work and
 * stayed faithful to the portal schema. No network, no token needed.
 *   node scripts/selfcheck.mjs   →  prints OK and exits 0, or throws on regression.
 */
import assert from 'node:assert';
import { validateDeal } from './validate.mjs';

const GOOD = {
  name: 'Four Seasons Townhomes', slug: 'four-seasons', status: 'active',
  location: { city: 'Greensboro', state: 'NC', address: '2705 Four Seasons Blvd', zip: '27407', display: 'Greensboro, North Carolina' },
  property: { type: 'Multifamily Value-Add', units: 90, yearBuilt: 1970 },
  transaction: { purchasePrice: 9721995, totalEquity: 4813998, agencyDebt: 6800000, capImprovements: 1420000 },
  engine: {
    equity: 4813998, loan: 6800000, rate: 0.0523, lpShare: 0.9, gpShare: 0.1,
    pref: 0.08, promote: 0.2, moicHurdle: 2.5, assetMgmt: 0.01, sellCost: 0.01, baseOcc: 0.95,
    baseNOI: [693600, 924800, 979200, 1020000, 1047200, 1081200, 1107537],
    baseOpex: [601560, 552600, 564120, 580050, 596340, 613080, 630270],
  },
  copy: { tagline: 'Value-add multifamily in the Piedmont Triad.', thesis: 'A 90-unit 1970s townhome community bought below replacement cost.' },
  teaser: { targetIRR: '~21%', equityMultiple: '~3.0×', holdYears: 7 },
  marketFindings: [{ tag: 'supportive', headline: 'Rent growth', body: 'Submarket rents up.', sources: [{ title: 'Census', url: 'https://census.gov/x' }], date: 'Q1 2025' }],
};

// 1) A sound deal validates and the engine computes real returns.
const ok = validateDeal(GOOD);
assert(ok.ok, 'expected GOOD deal to validate; got: ' + ok.errors.join('; '));
assert(ok.computed && Number.isFinite(ok.computed.dealIRR), 'expected finite Deal IRR');
assert(ok.computed.lpIRR > 0 && ok.computed.lpMult > 1, 'expected positive LP returns');

// 2) Broken shape is rejected with field-pathed errors.
const badShape = JSON.parse(JSON.stringify(GOOD)); delete badShape.copy.thesis;
const r2 = validateDeal(badShape);
assert(!r2.ok && r2.errors.some(e => e.startsWith('copy.thesis')), 'expected copy.thesis error');

// 3) Mismatched engine arrays → NaN guard catches it.
const badArr = JSON.parse(JSON.stringify(GOOD)); badArr.engine.baseOpex = [1, 2, 3];
const r3 = validateDeal(badArr);
assert(!r3.ok && r3.errors.some(e => e.includes('same number of years')), 'expected array-length error');

// 4) A finding with no source link is blocked (the research guardrail).
const noSrc = JSON.parse(JSON.stringify(GOOD)); noSrc.marketFindings[0].sources = [];
const r4 = validateDeal(noSrc);
assert(!r4.ok && r4.errors.some(e => e.includes('sources')), 'expected missing-source error');

console.log('selfcheck OK — validator + engine sound, shape/array/source guards firing.');
