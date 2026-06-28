/**
 * Fireside Strategies — finance engine (framework-agnostic, no DOM dependencies).
 * Verbatim copy of the portal's src/lib/engine.js; math is unchanged. Keep in
 * lockstep with the portal — this is the same model the live site renders with.
 *
 * Usage:
 *   import { run, irr, FOUR_SEASONS, DEFAULT_PARAMS, fmt$ } from './engine.mjs';
 *   const result = run(DEFAULT_PARAMS, FOUR_SEASONS);
 */

// ─── IRR via bisection ────────────────────────────────────────────────────────

export function irr(cfs) {
  let lo = -0.9, hi = 5;
  const npv = r => cfs.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (npv(m) > 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// Extend array `a` with compound growth `g` until it has `n` elements.
function ext(a, g, n) {
  const o = a.slice();
  while (o.length < n) o.push(o[o.length - 1] * (1 + g));
  return o;
}

// ─── Model ───────────────────────────────────────────────────────────────────

/**
 * Run the LP/GP waterfall model.
 *
 * @param {{ cap:number, rent:number, occ:number, exp:number, hold:number }} params
 *   Scenario levers. All rates are decimals (e.g. 0.0625 for 6.25%).
 *   - cap:  exit cap rate
 *   - rent: annual rent growth vs. base (delta, e.g. 0.01 = +1%)
 *   - occ:  stabilised occupancy (absolute, e.g. 0.95)
 *   - exp:  annual expense growth vs. base (delta)
 *   - hold: hold period in integer years
 *
 * @param {{ equity, loan, rate, lpShare, gpShare, pref, promote, moicHurdle,
 *            assetMgmt, sellCost, baseOcc, baseNOI, baseOpex }} deal
 *   Immutable deal record (capital structure + base-case cash-flow arrays).
 */
export function run(params, deal) {
  const baseRev = deal.baseNOI.map((n, i) => n + deal.baseOpex[i]);
  const REV  = ext(baseRev,       0.026, 11);
  const OPEX = ext(deal.baseOpex, 0.028, 11);

  const p   = params;
  const ds  = deal.loan * deal.rate;          // annual interest-only debt service
  const amf = deal.assetMgmt * deal.equity;   // asset management fee
  const occF = p.occ / deal.baseOcc;
  const Y   = p.hold;

  // ── Annual rows (Y operating years + 1 exit-NOI year) ──────────────────────
  const rows = [];
  for (let y = 1; y <= Y + 1; y++) {
    const rev  = REV[y - 1]  * Math.pow(1 + p.rent, y - 1) * occF;
    const opex = OPEX[y - 1] * Math.pow(1 + p.exp,  y - 1);
    const noi  = rev - opex;
    rows.push({ y, noi, ds, dscr: noi / ds, opCF: noi - ds - amf });
  }

  // ── Exit ───────────────────────────────────────────────────────────────────
  const exitNOI   = rows[Y].noi;               // year Y+1 NOI for cap-rate exit
  const exitValue = exitNOI / p.cap;
  const netSale   = exitValue * (1 - deal.sellCost) - deal.loan;

  // ── Total-equity cash flows ─────────────────────────────────────────────────
  const cfs = [-deal.equity];
  for (let y = 1; y <= Y; y++) {
    let c = rows[y - 1].opCF;
    if (y === Y) c += netSale;
    cfs.push(c);
  }

  const totalDist = cfs.slice(1).reduce((a, b) => a + b, 0);
  const dealIRR   = irr(cfs);
  const mult      = totalDist / deal.equity;
  const avgCoC    = rows.slice(0, Y).reduce((a, r) => a + r.opCF / deal.equity, 0) / Y;

  // ── LP / GP waterfall ──────────────────────────────────────────────────────
  const lpEq = deal.equity * deal.lpShare;
  const gpEq = deal.equity * deal.gpShare;
  let lpCap = lpEq, gpCap = gpEq;
  let prefAcc = 0, prefPaid = 0, catchPaid = 0, lpCum = 0;
  const lpCF = [-lpEq], gpCF = [-gpEq];

  for (let y = 1; y <= Y; y++) {
    prefAcc += lpCap * deal.pref;
    let A = cfs[y], lpD = 0, gpD = 0, pay;

    // Tier 1 — return of LP capital
    pay = Math.min(A, lpCap);  lpCap  -= pay; lpD += pay; A -= pay;
    // Tier 1b — return of GP capital
    pay = Math.min(A, gpCap);  gpCap  -= pay; gpD += pay; A -= pay;
    // Tier 2 — LP preferred return
    pay = Math.min(A, prefAcc); prefAcc -= pay; lpD += pay; prefPaid += pay; A -= pay;
    // Tier 3 — GP catch-up (20% of pref)
    const cd = prefPaid * (deal.promote / (1 - deal.promote)) - catchPaid;
    pay = Math.min(A, Math.max(0, cd)); gpD += pay; catchPaid += pay; A -= pay;
    // Tier 4/5 — profit split (80/20 until 2.5× MOIC, then 50/50)
    if (A > 0) {
      const s = (lpCum < deal.moicHurdle * lpEq) ? 0.8 : 0.5;
      lpD += A * s; gpD += A * (1 - s);
    }

    lpCum += lpD;
    lpCF.push(lpD);
    gpCF.push(gpD);
  }

  const lpDist = lpCF.slice(1).reduce((a, b) => a + b, 0);
  const gpDist = gpCF.slice(1).reduce((a, b) => a + b, 0);

  return {
    rows, Y, exitValue, exitNOI, netSale, dealIRR, mult, avgCoC, totalDist,
    profit:  totalDist - deal.equity,
    lpIRR:   irr(lpCF), lpMult: lpDist / lpEq, lpDist,
    gpIRR:   irr(gpCF), gpMult: gpDist / gpEq, gpDist,
    cfs,
  };
}

// ─── Formatters ──────────────────────────────────────────────────────────────

export const fmt$    = n => '$' + Math.round(n).toLocaleString('en-US');
export const fmt$M   = n => '$' + (n / 1e6).toFixed(2) + 'M';
export const fmtPct  = (n, d = 1) => (n * 100).toFixed(d) + '%';
export const fmtMult = n => n.toFixed(2) + 'x';

// ─── Default deal record — Four Seasons Townhomes ────────────────────────────
export const FOUR_SEASONS = Object.freeze({
  equity:      4_813_998,
  loan:        6_800_000,
  rate:        0.0523,
  lpShare:     0.90,
  gpShare:     0.10,
  pref:        0.08,
  promote:     0.20,
  moicHurdle:  2.5,
  assetMgmt:   0.01,
  sellCost:    0.01,
  baseOcc:     0.95,
  baseNOI:  [693_600, 924_800,  979_200, 1_020_000, 1_047_200, 1_081_200, 1_107_537],
  baseOpex: [601_560, 552_600,  564_120,   580_050,   596_340,   613_080,   630_270],
});

export const DEFAULT_PARAMS = Object.freeze({
  cap:  0.0625, rent: 0, occ:  0.95, exp:  0, hold: 7,
});
