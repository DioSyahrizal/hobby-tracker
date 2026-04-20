/**
 * Deterministic scoring engine for "What should I do tonight?".
 *
 * Total possible score: 125 points
 *   priority   0–40  (item.priority 1-5 mapped to 0/10/20/30/40)
 *   timeFit    0–30  (exact match 30, ±1 level 15, ±2 level 5, ±3 level 0)
 *   loadFit    0–20  (exact match 20, ±1 level 10, ±2 level 0)
 *   moodFit    0–15  (5 pts per matching tag, capped at 15)
 *   staleness  0–20  (rewards items untouched for a while)
 */
import type { RecommendRequest, RecommendResult } from '@hobby-track/shared';
import type { Item as ItemRow } from '../db/schema.js';
import { serializeItem } from '../lib/serialize.js';

// ── Level maps ────────────────────────────────────────────────────────────────

const TIME_LEVEL: Record<string, number> = {
  short: 0,
  medium: 1,
  long: 2,
  very_long: 3,
};

const LOAD_LEVEL: Record<string, number> = {
  light: 0,
  medium: 1,
  heavy: 2,
};

// Points by absolute difference between user input level and item level
const TIME_SCORE_BY_DIFF = [30, 15, 5, 0] as const;
const LOAD_SCORE_BY_DIFF = [20, 10, 0] as const;

// ── Scorer ────────────────────────────────────────────────────────────────────

export function scoreItem(row: ItemRow, req: RecommendRequest): RecommendResult {
  const reasons: string[] = [];

  // ── Priority (0–40) ────────────────────────────────────────────────────────
  const priorityScore = (row.priority - 1) * 10;
  if (row.priority === 5) reasons.push('Top priority');
  else if (row.priority === 4) reasons.push('High priority');

  // ── Time fit (0–30) ────────────────────────────────────────────────────────
  let timeFit: number;
  if (row.timeCommitment) {
    const diff = Math.abs((TIME_LEVEL[row.timeCommitment] ?? 0) - (TIME_LEVEL[req.time] ?? 0));
    timeFit = TIME_SCORE_BY_DIFF[diff] ?? 0;
    if (diff === 0) reasons.push('Fits your time window');
  } else {
    timeFit = 10; // no data → neutral
  }

  // ── Load fit (0–20) ────────────────────────────────────────────────────────
  let loadFit: number;
  if (row.mentalLoad) {
    const diff = Math.abs((LOAD_LEVEL[row.mentalLoad] ?? 0) - (LOAD_LEVEL[req.energy] ?? 0));
    loadFit = LOAD_SCORE_BY_DIFF[diff] ?? 0;
    if (diff === 0) reasons.push('Matches your energy level');
  } else {
    loadFit = 7; // no data → neutral
  }

  // ── Mood fit (0–15) ────────────────────────────────────────────────────────
  let moodFit = 0;
  if (req.mood && req.mood.length > 0 && row.moodTags && row.moodTags.length > 0) {
    const userMoods = new Set(req.mood.map((m) => m.toLowerCase()));
    const matches = row.moodTags.filter((t) => userMoods.has(t.toLowerCase()));
    moodFit = Math.min(matches.length * 5, 15);
    if (moodFit > 0) {
      reasons.push(`Mood match: ${matches.join(', ')}`);
    }
  }

  // ── Staleness bonus (0–20) ─────────────────────────────────────────────────
  let staleness: number;
  if (row.lastTouchedAt) {
    const daysSince = (Date.now() - row.lastTouchedAt.getTime()) / 86_400_000;
    if (daysSince > 30) {
      staleness = 20;
      reasons.push("You haven't touched this in a while");
    } else if (daysSince > 14) {
      staleness = 10;
    } else if (daysSince > 7) {
      staleness = 5;
    } else {
      staleness = 0;
    }
  } else {
    staleness = 15; // never started — encourage beginning
    reasons.push('Good time to begin');
  }

  const total = priorityScore + timeFit + loadFit + moodFit + staleness;

  return {
    item: serializeItem(row),
    score: total,
    breakdown: {
      priority: priorityScore,
      timeFit,
      loadFit,
      moodFit,
      staleness,
      total,
    },
    reasons: reasons.length > 0 ? reasons : ['In your active backlog'],
  };
}
