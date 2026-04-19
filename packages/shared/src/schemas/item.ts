import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const itemTypeSchema = z.enum(['game', 'anime', 'book', 'gunpla']);
export type ItemType = z.infer<typeof itemTypeSchema>;

export const itemStatusSchema = z.enum([
  'wishlist',
  'active',
  'paused',
  'completed',
  'dropped',
]);
export type ItemStatus = z.infer<typeof itemStatusSchema>;

export const timeCommitmentSchema = z.enum(['short', 'medium', 'long', 'very_long']);
export type TimeCommitment = z.infer<typeof timeCommitmentSchema>;

export const mentalLoadSchema = z.enum(['light', 'medium', 'heavy']);
export type MentalLoad = z.infer<typeof mentalLoadSchema>;

export const externalSourceSchema = z.enum(['rawg', 'jikan', 'gbooks']);
export type ExternalSource = z.infer<typeof externalSourceSchema>;

// ── Output (what the API returns) ────────────────────────────────────────────

export const itemSchema = z.object({
  id: z.uuid(),
  type: itemTypeSchema,
  title: z.string().min(1).max(500),
  status: itemStatusSchema,
  currentProgress: z.string().max(1000).nullable(),
  priority: z.number().int().min(1).max(5),
  timeCommitment: timeCommitmentSchema.nullable(),
  mentalLoad: mentalLoadSchema.nullable(),
  moodTags: z.array(z.string()).nullable(),
  coverUrl: z.string().max(2000).nullable(),
  externalId: z.string().max(100).nullable(),
  externalSource: externalSourceSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  notes: z.string().max(10000).nullable(),
  rating: z.number().int().min(1).max(10).nullable(),
  lastTouchedAt: z.iso.datetime().nullable(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Item = z.infer<typeof itemSchema>;

// ── Input: create ────────────────────────────────────────────────────────────

export const itemCreateSchema = z.object({
  type: itemTypeSchema,
  title: z.string().min(1).max(500),
  status: itemStatusSchema.optional(),
  currentProgress: z.string().max(1000).nullish(),
  priority: z.number().int().min(1).max(5).optional(),
  timeCommitment: timeCommitmentSchema.nullish(),
  mentalLoad: mentalLoadSchema.nullish(),
  moodTags: z.array(z.string().min(1).max(50)).max(20).nullish(),
  coverUrl: z.string().max(2000).nullish(),
  externalId: z.string().max(100).nullish(),
  externalSource: externalSourceSchema.nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  notes: z.string().max(10000).nullish(),
  rating: z.number().int().min(1).max(10).nullish(),
});
export type ItemCreate = z.infer<typeof itemCreateSchema>;

// ── Input: update (all optional) ─────────────────────────────────────────────

export const itemUpdateSchema = itemCreateSchema.partial();
export type ItemUpdate = z.infer<typeof itemUpdateSchema>;

// ── List query ───────────────────────────────────────────────────────────────

export const itemSortSchema = z.enum(['recent', 'priority', 'title', 'last_touched']);
export type ItemSort = z.infer<typeof itemSortSchema>;

export const itemListQuerySchema = z.object({
  type: itemTypeSchema.optional(),
  status: itemStatusSchema.optional(),
  search: z.string().min(1).max(200).optional(),
  sort: itemSortSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ItemListQuery = z.infer<typeof itemListQuerySchema>;

export const itemListResponseSchema = z.object({
  items: z.array(itemSchema),
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
});
export type ItemListResponse = z.infer<typeof itemListResponseSchema>;

// ── ?force=true for active-limit override ────────────────────────────────────

export const forceQuerySchema = z.object({
  force: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

// ── Active-limit conflict response (409) ─────────────────────────────────────

export const activeLimitErrorSchema = z.object({
  error: z.object({
    code: z.literal('ACTIVE_LIMIT_EXCEEDED'),
    message: z.string(),
    details: z.object({
      type: itemTypeSchema,
      currentActiveCount: z.number().int().min(0),
      limit: z.number().int().min(0),
    }),
  }),
});
