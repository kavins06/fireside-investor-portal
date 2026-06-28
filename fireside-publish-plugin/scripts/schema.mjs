/**
 * schema.mjs — shape validation for a Fireside deal record. Pure JS, zero deps.
 *
 * Faithful port of the portal's canonical zod schema
 * (portal/src/lib/deal-schema.mjs) so this plugin validates a deal with no
 * npm install. Returns a flat list of { path, message } issues — [] when valid.
 *
 * ponytail: hand-rolled to keep the plugin dependency-free. CEILING — this is a
 * fork of the zod schema; if the portal schema changes, mirror it here. The
 * self-check (selfcheck.mjs) + validating the canonical four-seasons.json catch
 * gross drift. If the schema starts churning, bundle zod instead of forking.
 */

const httpsUrlRe = /^https:\/\/\S+$/i;
const imageRefRe = /^(\/\S*|https:\/\/\S+)$/i;
const slugRe     = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export function validateShape(deal) {
  const issues = [];
  const add = (path, message) => issues.push({ path, message });

  function str(v, path, { min = 0, max = Infinity, opt = false } = {}) {
    if (v === undefined) { if (!opt) add(path, 'Required'); return; }
    if (typeof v !== 'string') { add(path, 'must be a string'); return; }
    if (v.length < min) add(path, min === 1 ? 'must not be empty' : `must be at least ${min} characters`);
    if (v.length > max) add(path, `must be at most ${max} characters`);
  }
  function num(v, path, { opt = false } = {}) {
    if (v === undefined) { if (!opt) add(path, 'Required'); return; }
    if (typeof v !== 'number' || Number.isNaN(v)) add(path, 'must be a number');
  }
  function re(v, path, regex, message, { opt = false, min = 0, max = Infinity } = {}) {
    if (v === undefined) { if (!opt) add(path, 'Required'); return; }
    if (typeof v !== 'string') { add(path, 'must be a string'); return; }
    if (!regex.test(v)) add(path, message);
    if (v.length < min) add(path, 'must not be empty');
    if (v.length > max) add(path, `must be at most ${max} characters`);
  }

  if (!isObj(deal)) { add('(root)', 'deal must be an object'); return issues; }

  str(deal.name, 'name', { min: 1, max: 90 });
  re(deal.slug, 'slug', slugRe, 'slug must be kebab-case (lowercase, hyphen-separated)', { max: 60 });
  if (!['active', 'fundraising', 'closed'].includes(deal.status))
    add('status', "must be 'active', 'fundraising', or 'closed'");

  if (!isObj(deal.location)) add('location', 'Required'); else {
    str(deal.location.city,    'location.city',    { max: 70 });
    str(deal.location.state,   'location.state',   { max: 40 });
    str(deal.location.address, 'location.address', { max: 140 });
    str(deal.location.zip,     'location.zip',     { max: 20 });
    str(deal.location.display, 'location.display', { max: 120 });
  }

  if (!isObj(deal.property)) add('property', 'Required'); else {
    const pr = deal.property;
    str(pr.type,        'property.type',        { max: 80 });
    num(pr.units,       'property.units');
    str(pr.unitMix,     'property.unitMix',     { max: 80, opt: true });
    num(pr.yearBuilt,   'property.yearBuilt');
    num(pr.buildings,   'property.buildings',   { opt: true });
    num(pr.acres,       'property.acres',       { opt: true });
    num(pr.sqftPerUnit, 'property.sqftPerUnit', { opt: true });
    str(pr.occupancy,   'property.occupancy',   { max: 24, opt: true });
    str(pr.coGP,        'property.coGP',        { max: 90, opt: true });
  }

  if (!isObj(deal.transaction)) add('transaction', 'Required'); else {
    for (const k of ['purchasePrice', 'totalEquity', 'agencyDebt', 'capImprovements'])
      num(deal.transaction[k], `transaction.${k}`);
  }

  if (!isObj(deal.engine)) add('engine', 'Required'); else {
    const e = deal.engine;
    for (const k of ['equity','loan','rate','lpShare','gpShare','pref','promote','moicHurdle','assetMgmt','sellCost','baseOcc'])
      num(e[k], `engine.${k}`);
    for (const k of ['baseNOI', 'baseOpex']) {
      const a = e[k];
      if (!Array.isArray(a) || a.length < 1) add(`engine.${k}`, 'must be a non-empty array of numbers');
      else if (!a.every(n => typeof n === 'number' && !Number.isNaN(n))) add(`engine.${k}`, 'must contain only numbers');
    }
    if (Array.isArray(e.baseNOI) && Array.isArray(e.baseOpex) && e.baseNOI.length !== e.baseOpex.length)
      add('engine.baseOpex', 'engine.baseNOI and engine.baseOpex must have the same number of years (the engine pairs them index-by-index)');
  }

  if (!isObj(deal.copy)) add('copy', 'Required'); else {
    str(deal.copy.tagline,     'copy.tagline',     { min: 1, max: 500 });
    str(deal.copy.thesis,      'copy.thesis',      { min: 1, max: 5000 });
    str(deal.copy.marketNotes, 'copy.marketNotes', { max: 5000, opt: true });
  }

  if (!isObj(deal.teaser)) add('teaser', 'Required'); else {
    str(deal.teaser.targetIRR,      'teaser.targetIRR',      { max: 24 });
    str(deal.teaser.equityMultiple, 'teaser.equityMultiple', { max: 24 });
    num(deal.teaser.holdYears,      'teaser.holdYears');
  }

  if (deal.images !== undefined) {
    if (!isObj(deal.images)) add('images', 'must be an object'); else {
      re(deal.images.hero,     'images.hero',     imageRefRe, 'image must be an https:// URL or a /assets/… path', { opt: true });
      re(deal.images.exterior, 'images.exterior', imageRefRe, 'image must be an https:// URL or a /assets/… path', { opt: true });
      if (deal.images.property !== undefined) {
        if (!Array.isArray(deal.images.property)) add('images.property', 'must be an array');
        else {
          if (deal.images.property.length > 12) add('images.property', 'at most 12 images');
          deal.images.property.forEach((u, i) => re(u, `images.property.${i}`, imageRefRe, 'image must be an https:// URL or a /assets/… path'));
        }
      }
      str(deal.images.credit, 'images.credit', { max: 160, opt: true });
    }
  }

  str(deal.marketLabel, 'marketLabel', { max: 140, opt: true });
  str(deal.marketAsOf,  'marketAsOf',  { max: 40,  opt: true });

  if (deal.marketFindings !== undefined) {
    if (!Array.isArray(deal.marketFindings)) add('marketFindings', 'must be an array');
    else {
      if (deal.marketFindings.length > 8) add('marketFindings', 'at most 8 findings');
      deal.marketFindings.forEach((f, i) => {
        const p = `marketFindings.${i}`;
        if (!isObj(f)) { add(p, 'must be an object'); return; }
        if (!['supportive', 'watch', 'challenge'].includes(f.tag)) add(`${p}.tag`, "must be 'supportive', 'watch', or 'challenge'");
        str(f.headline, `${p}.headline`, { max: 160 });
        str(f.body,     `${p}.body`,     { max: 800 });
        str(f.date,     `${p}.date`,     { max: 30 });
        if (!Array.isArray(f.sources) || f.sources.length < 1)
          add(`${p}.sources`, 'each market finding needs at least one source with a working https:// link — verify the figure first');
        else {
          if (f.sources.length > 6) add(`${p}.sources`, 'at most 6 sources');
          f.sources.forEach((s, j) => {
            const sp = `${p}.sources.${j}`;
            if (!isObj(s)) { add(sp, 'must be an object'); return; }
            str(s.title, `${sp}.title`, { min: 1, max: 160 });
            re(s.url, `${sp}.url`, httpsUrlRe, 'must be a full https:// URL');
          });
        }
      });
    }
  }

  return issues;
}
