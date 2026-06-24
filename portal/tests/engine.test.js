/**
 * Engine parity tests — verify the extracted engine.js produces the same
 * base-case outputs as the original Four Seasons Investor Dashboard.
 *
 * Run with:  node --test tests/engine.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { irr, run, FOUR_SEASONS, DEFAULT_PARAMS, fmt$, fmt$M, fmtPct, fmtMult } from '../src/lib/engine.js';

// ─── IRR utility ─────────────────────────────────────────────────────────────

test('irr() — simple 1-year case: -1000 → +1200 = 20%', () => {
  const r = irr([-1000, 1200]);
  assert.ok(r !== null, 'should not return null');
  assert.ok(Math.abs(r - 0.20) < 0.0001, `Expected ~20%, got ${(r * 100).toFixed(4)}%`);
});

test('irr() — returns null when cash flows are all negative (no root)', () => {
  // Invest $100, get $0 back — npv is always negative, no sign change → null
  const r = irr([-100, -100]);
  assert.strictEqual(r, null, 'should return null when no real root exists');
});

// ─── Four Seasons base-case parity ───────────────────────────────────────────

test('run() — base case: deal IRR in expected range (18–24%)', () => {
  // Four Seasons is a value-add deal: NOI nearly doubles in Year 2 ($693K → $924K)
  // driving a strong IRR. Actual base-case output: ~20.9%.
  const r = run(DEFAULT_PARAMS, FOUR_SEASONS);
  assert.ok(r.dealIRR !== null, 'deal IRR should not be null');
  assert.ok(
    r.dealIRR > 0.18 && r.dealIRR < 0.24,
    `Deal IRR out of expected range: ${fmtPct(r.dealIRR, 2)}`
  );
});

test('run() — base case: equity multiple in expected range (2.8–3.5×)', () => {
  // Value-add repositioning yields ~3.16× at the 6.25% exit cap.
  const r = run(DEFAULT_PARAMS, FOUR_SEASONS);
  assert.ok(
    r.mult > 2.8 && r.mult < 3.5,
    `Equity multiple out of range: ${fmtMult(r.mult)}`
  );
});

test('run() — base case: LP IRR is below deal IRR (waterfall tax)', () => {
  const r = run(DEFAULT_PARAMS, FOUR_SEASONS);
  assert.ok(r.lpIRR < r.dealIRR, 'LP IRR must be below deal IRR');
  assert.ok(r.lpIRR > 0.10, `LP IRR too low: ${fmtPct(r.lpIRR, 2)}`);
});

test('run() — base case: LP multiple above 1.5×', () => {
  const r = run(DEFAULT_PARAMS, FOUR_SEASONS);
  assert.ok(r.lpMult > 1.5, `LP multiple too low: ${fmtMult(r.lpMult)}`);
});

test('run() — base case: GP receives promote above contributed capital', () => {
  const { gpDist, gpMult } = run(DEFAULT_PARAMS, FOUR_SEASONS);
  const gpEq = FOUR_SEASONS.equity * FOUR_SEASONS.gpShare;
  assert.ok(gpDist > gpEq, 'GP distributions should exceed GP equity');
  assert.ok(gpMult > 1.0, `GP multiple should be > 1×, got ${fmtMult(gpMult)}`);
});

test('run() — base case: NOI for operating years matches dashboard at base params', () => {
  const r = run(DEFAULT_PARAMS, FOUR_SEASONS);
  // At occ=baseOcc, rent=0, exp=0 the operating years should reproduce baseNOI.
  // We check the first 7 rows (Y=7 hold, but rows[0..6] are operating).
  FOUR_SEASONS.baseNOI.forEach((expectedNOI, i) => {
    const got = r.rows[i].noi;
    assert.ok(
      Math.abs(got - expectedNOI) < 1,
      `Year ${i + 1} NOI mismatch: expected ${fmt$(expectedNOI)}, got ${fmt$(got)}`
    );
  });
});

test('run() — base case: exit value = exitNOI / cap rate', () => {
  const r = run(DEFAULT_PARAMS, FOUR_SEASONS);
  const expected = r.exitNOI / DEFAULT_PARAMS.cap;
  assert.ok(
    Math.abs(r.exitValue - expected) < 1,
    `exitValue ${fmt$(r.exitValue)} ≠ exitNOI/cap ${fmt$(expected)}`
  );
});

test('run() — base case: total distributions = LP dist + GP dist + equity (double-check)', () => {
  const r = run(DEFAULT_PARAMS, FOUR_SEASONS);
  // totalDist includes equity return, profit split
  assert.ok(
    Math.abs((r.lpDist + r.gpDist) - r.totalDist) < 1,
    `lpDist + gpDist (${fmt$(r.lpDist + r.gpDist)}) ≠ totalDist (${fmt$(r.totalDist)})`
  );
});

// ─── Sensitivity / structural checks ─────────────────────────────────────────

test('run() — higher cap rate reduces IRR and multiple', () => {
  const base   = run(DEFAULT_PARAMS, FOUR_SEASONS);
  const stress = run({ ...DEFAULT_PARAMS, cap: 0.08 }, FOUR_SEASONS);
  assert.ok(stress.dealIRR < base.dealIRR, 'Higher cap rate → lower deal IRR');
  assert.ok(stress.mult    < base.mult,    'Higher cap rate → lower equity multiple');
});

test('run() — lower occupancy reduces operating cash flows', () => {
  const base  = run(DEFAULT_PARAMS, FOUR_SEASONS);
  const bear  = run({ ...DEFAULT_PARAMS, occ: 0.88 }, FOUR_SEASONS);
  assert.ok(bear.dealIRR < base.dealIRR, 'Lower occupancy → lower IRR');
});

test('run() — shorter hold returns correct row count', () => {
  const r = run({ ...DEFAULT_PARAMS, hold: 5 }, FOUR_SEASONS);
  assert.strictEqual(r.rows.length, 6, 'rows should have Y+1 entries');
  assert.strictEqual(r.cfs.length,  6, 'cfs should have Y+1 entries (t=0…Y)');
  assert.strictEqual(r.Y, 5, 'Y should equal hold');
});

test('run() — longer hold returns correct row count', () => {
  const r = run({ ...DEFAULT_PARAMS, hold: 10 }, FOUR_SEASONS);
  assert.strictEqual(r.rows.length, 11, 'rows should have Y+1 entries for 10-yr hold');
});

// ─── Formatters ──────────────────────────────────────────────────────────────

test('fmt$() — rounds and formats with commas', () => {
  assert.strictEqual(fmt$(1234567.89), '$1,234,568');
  assert.strictEqual(fmt$(0), '$0');
});

test('fmt$M() — formats in millions to 2dp', () => {
  assert.strictEqual(fmt$M(4813998), '$4.81M');
});

test('fmtPct() — formats as percent', () => {
  assert.strictEqual(fmtPct(0.1350), '13.5%');
  assert.strictEqual(fmtPct(0.1234, 2), '12.34%');
});

test('fmtMult() — formats as multiple', () => {
  assert.strictEqual(fmtMult(2.456), '2.46x');
});
