import { defineCollection } from 'astro:content';
// Single source of truth — shared with the CLI validator and the publish
// connector so the build gate and the publish gate can't drift. See deal-schema.mjs.
import { dealSchema } from '../lib/deal-schema.mjs';

const deals = defineCollection({
  type: 'data',
  schema: dealSchema,
});

export const collections = { deals };
