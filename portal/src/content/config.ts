import { defineCollection, z } from 'astro:content';

const engineSchema = z.object({
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
  baseNOI:    z.array(z.number()),
  baseOpex:   z.array(z.number()),
});

const deals = defineCollection({
  type: 'data',
  schema: z.object({
    name:   z.string(),
    slug:   z.string(),
    status: z.enum(['active', 'fundraising', 'closed']),

    location: z.object({
      city:    z.string(),
      state:   z.string(),
      address: z.string(),
      zip:     z.string(),
      display: z.string(),
    }),

    property: z.object({
      type:       z.string(),
      units:      z.number(),
      unitMix:    z.string().optional(),
      yearBuilt:  z.number(),
      buildings:  z.number().optional(),
      acres:      z.number().optional(),
      sqftPerUnit: z.number().optional(),
      occupancy:  z.string().optional(),
      coGP:       z.string().optional(),
    }),

    transaction: z.object({
      purchasePrice:   z.number(),
      totalEquity:     z.number(),
      agencyDebt:      z.number(),
      capImprovements: z.number(),
    }),

    engine: engineSchema,

    copy: z.object({
      tagline:     z.string(),
      thesis:      z.string(),
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
  }),
});

export const collections = { deals };
