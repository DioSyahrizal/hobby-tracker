import type { Settings as SettingsRow } from '../db/schema.js';
import type { ItemWithTags } from '../services/items.js';
import type { Item, Settings } from '@hobby-track/shared';

export function serializeItem(row: ItemWithTags): Item {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    currentProgress: row.currentProgress,
    priority: row.priority,
    timeCommitment: row.timeCommitment,
    mentalLoad: row.mentalLoad,
    moodTags: row.moodTags,
    coverUrl: row.coverUrl,
    externalId: row.externalId,
    externalSource: row.externalSource as Item['externalSource'],
    metadata: row.metadata as Item['metadata'],
    notes: row.notes,
    rating: row.rating,
    lastTouchedAt: row.lastTouchedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeSettings(row: SettingsRow): Settings {
  return {
    id: 1,
    activeLimitGame: row.activeLimitGame,
    activeLimitAnime: row.activeLimitAnime,
    activeLimitBook: row.activeLimitBook,
    activeLimitGunpla: row.activeLimitGunpla,
    theme: row.theme as Settings['theme'],
    updatedAt: row.updatedAt.toISOString(),
  };
}
