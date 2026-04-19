import { z } from 'zod';
import { externalSourceSchema, itemTypeSchema } from './item.js';

/**
 * Normalized search-result shape returned by all three external-source proxies.
 * The frontend can render results from RAWG / Jikan / Google Books with one
 * component, then POST the chosen result's fields straight into /api/items.
 */
export const searchResultSchema = z.object({
  source: externalSourceSchema,
  externalId: z.string().min(1).max(100),
  type: itemTypeSchema.exclude(['gunpla']), // gunpla has no API source
  title: z.string().min(1).max(500),
  coverUrl: z.string().max(2000).nullable(),
  releaseYear: z.number().int().min(1800).max(2100).nullable(),
  description: z.string().max(5000).nullable(),
  /** Type-specific extras (platforms, episodes, authors, etc.). */
  metadata: z.record(z.string(), z.unknown()).nullable(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().positive().max(20).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  cached: z.boolean(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
