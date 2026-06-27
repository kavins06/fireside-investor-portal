/**
 * Single source of truth for the shape of a Fireside deal record.
 *
 * Consumed by:
 *   - src/content/config.ts   (Astro content collection — build-time gate)
 *   - src/lib/deal-validation.mjs (CLI + the publish connector — pre-commit gate)
 *
 * Plain ESM + zod (no astro:content import) so node and the Astro bundle can
 * both load it. Keep this in lockstep with the worked reference
 * src/content/deals/four-seasons.json.
 *
 * ponytail: one schema, three consumers — drift here would let a broken deal
 * pass one gate and fail another. Don't fork it.
 */
import { z } from 'zod';

// ── UI-safety helpers ────────────────────────────────────────────────────────
// A deal is pure data rendered into a FIXED design — publishers change datapoints,
// never UI/UX. Two ways data could still leak into the UI, both closed here:
//   1. URLs: only https:// (external) or a site-relative /assets path. Blocks
//      javascript:/data:/http: — so no script-on-click and no off-scheme surprises.
//   2. Length: every free-text field is capped so content can't overflow or distort
//      the layout. (Text is already auto-escaped by Astro — no HTML/CSS/JS injection.)
const httpsUrl = z.string().regex(/^https:\/\/\S+$/i, 'must be a full https:// URL');
const imageRef = z.string().regex(/^(\/\S*|https:\/\/\S+)$/i, 'image must be an https:// URL or a /assets/… path');

export const engineSchema = z.object({
  equity:     z.number(),
  loan:       z.number(),
  rate:       z.number(),
  lpShare:    z.number(),
  gpShare:    z.number(),
  pref:       z.number(),
  promote:    z.number(),
  moicHurdle: z.number(),
  assetMgmt:  z.number(),
  sellCost:   z.number(),
  baseOcc:    z.number(),
  baseNOI:    z.array(z.number()).min(1),
  baseOpex:   z.array(z.number()).min(1),
}).refine(e => e.baseNOI.length === e.baseOpex.length, {
  message: 'engine.baseNOI and engine.baseOpex must have the same number of years (the engine pairs them index-by-index)',
  path: ['baseOpex'],
});

export const dealSchema = z.object({
  name:   z.string().min(1).max(90),
  slug:   z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case (lowercase, hyphen-separated)').max(60),
  status: z.enum(['active', 'fundraising', 'closed']),

  location: z.object({
    city:    z.string().max(70),
    state:   z.string().max(40),
    address: z.string().max(140),
    zip:     z.string().max(20),
    display: z.string().max(120),
  }),

  property: z.object({
    type:        z.string().max(80),
    units:       z.number(),
    unitMix:     z.string().max(80).optional(),
    yearBuilt:   z.number(),
    buildings:   z.number().optional(),
    acres:       z.number().optional(),
    sqftPerUnit: z.number().optional(),
    occupancy:   z.string().max(24).optional(),
    coGP:        z.string().max(90).optional(),
  }),

  transaction: z.object({
    purchasePrice:   z.number(),
    totalEquity:     z.number(),
    agencyDebt:      z.number(),
    capImprovements: z.number(),
  }),

  engine: engineSchema,

  copy: z.object({
    tagline:     z.string().min(1).max(500),
    thesis:      z.string().min(1).max(5000),
    marketNotes: z.string().max(5000).optional(),
  }),

  teaser: z.object({
    targetIRR:      z.string().max(24),
    equityMultiple: z.string().max(24),
    holdYears:      z.number(),
  }),

  // Images are https URLs or site-relative /assets paths only (no script/off-scheme URLs).
  images: z.object({
    hero:     imageRef.optional(),
    exterior: imageRef.optional(),
    property: z.array(imageRef).max(12).optional(),
    credit:   z.string().max(160).optional(),
  }).optional(),

  // Market Pulse framing — keep current: the authoring skill sets marketAsOf to the
  // latest reporting period that actually has data (anchored to today's date), never
  // a fixed/old date. Both optional; the section degrades gracefully without them.
  marketLabel: z.string().max(140).optional(),   // e.g. "Greensboro–Piedmont Triad multifamily submarket"
  marketAsOf:  z.string().max(40).optional(),    // e.g. "Q2 2026"

  marketFindings: z.array(z.object({
    tag:      z.enum(['supportive', 'watch', 'challenge']),
    headline: z.string().max(160),
    body:     z.string().max(800),
    // Every finding must cite at least one real, checkable source with a working link.
    // This is the structural backstop behind the deep-research rule: an unsourced or
    // fake-link finding fails validation, so it cannot be published. Links must be https
    // (a clickable <a>) — no javascript:/data: schemes.
    sources:  z.array(z.object({
      title: z.string().min(1).max(160),
      url:   httpsUrl,
    })).min(1, 'each market finding needs at least one source with a working https:// link — verify the figure first').max(6),
    date:     z.string().max(30),
  })).max(8).optional(),
});
