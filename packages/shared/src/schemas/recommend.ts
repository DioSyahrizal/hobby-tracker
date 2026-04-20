import { z } from 'zod';
import { mentalLoadSchema, timeCommitmentSchema } from './item.js';
import { itemSchema } from './item.js';

// ── Request ───────────────────────────────────────────────────────────────────

export const recommendRequestSchema = z.object({
  /** How much time the user has available right now. */
  time: timeCommitmentSchema,
  /** User's current energy / mental capacity. */
  energy: mentalLoadSchema,
  /** Optional mood tags the user is in the mood for (e.g. "cozy", "intense"). */
  mood: z.array(z.string().min(1).max(50)).max(20).optional(),
});
export type RecommendRequest = z.infer<typeof recommendRequestSchema>;

// ── Response ──────────────────────────────────────────────────────────────────

export const scoreBreakdownSchema = z.object({
  /** Points from item priority (0–40). */
  priority: z.number().int().min(0),
  /** Points from time-commitment match (0–30). */
  timeFit: z.number().int().min(0),
  /** Points from mental-load match (0–20). */
  loadFit: z.number().int().min(0),
  /** Points from mood-tag overlap (0–15). */
  moodFit: z.number().int().min(0),
  /** Bonus for items not touched recently (0–20). */
  staleness: z.number().int().min(0),
  /** Sum of all components. Max theoretical score: 125. */
  total: z.number().int().min(0),
});
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export const recommendResultSchema = z.object({
  item: itemSchema,
  score: z.number().int().min(0),
  breakdown: scoreBreakdownSchema,
  /** Human-readable reasons why this item was recommended. */
  reasons: z.array(z.string()),
});
export type RecommendResult = z.infer<typeof recommendResultSchema>;

export const recommendResponseSchema = z.object({
  results: z.array(recommendResultSchema),
});
export type RecommendResponse = z.infer<typeof recommendResponseSchema>;
