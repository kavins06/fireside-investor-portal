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
  name:   z.string().min(1),
  slug:   z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case (lowercase, hyphen-separated)'),
  status: z.enum(['active', 'fundraising', 'closed']),

  location: z.object({
    city:    z.string(),
    state:   z.string(),
    address: z.string(),
    zip:     z.string(),
    display: z.string(),
  }),

  property: z.object({
    type:        z.string(),
    units:       z.number(),
    unitMix:     z.string().optional(),
    yearBuilt:   z.number(),
    buildings:   z.number().optional(),
    acres:       z.number().optional(),
    sqftPerUnit: z.number().optional(),
    occupancy:   z.string().optional(),
    coGP:        z.string().optional(),
  }),

  transaction: z.object({
    purchasePrice:   z.number(),
    totalEquity:     z.number(),
    agencyDebt:      z.number(),
    capImprovements: z.number(),
  }),

  engine: engineSchema,

  copy: z.object({
    tagline:     z.string().min(1),
    thesis:      z.string().min(1),
    marketNotes: z.string().optional(),
  }),

  teaser: z.object({
    targetIRR:      z.string(),
    equityMultiple: z.string(),
    holdYears:      z.number(),
  }),

  images: z.object({
    hero:     z.string().optional(),
    exterior: z.string().optional(),
    property: z.array(z.string()).optional(),
    credit:   z.string().optional(),
  }).optional(),

  marketFindings: z.array(z.object({
    tag:      z.enum(['supportive', 'watch', 'challenge']),
    headline: z.string(),
    body:     z.string(),
    source:   z.string(),
    date:     z.string(),
  })).optional(),
});
