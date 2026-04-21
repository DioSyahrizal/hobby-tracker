import type { ItemCreate, ItemListQuery, ItemType, ItemUpdate } from '@hobby-track/shared';
import { and, asc, desc, eq, ilike, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  itemMoodTags,
  items,
  moodTags,
  settings,
  type Item as ItemRow,
  type NewItem,
} from '../db/schema.js';
import type { ActiveLimitExceededResult, NotFoundResult } from '../lib/errors.js';

// ── ItemWithTags ─────────────────────────────────────────────────────────────

export interface MoodTagRef {
  id: number;
  name: string;
}

/** ItemRow extended with the resolved mood tags from the junction table. */
export type ItemWithTags = ItemRow & { moodTags: MoodTagRef[] };

// ── Tag helpers ───────────────────────────────────────────────────────────────

async function fetchTagsForItems(
  itemIds: string[],
): Promise<Map<string, MoodTagRef[]>> {
  if (itemIds.length === 0) return new Map();

  const rows = await db
    .select({
      itemId: itemMoodTags.itemId,
      tagId: moodTags.id,
      tagName: moodTags.name,
    })
    .from(itemMoodTags)
    .innerJoin(moodTags, eq(moodTags.id, itemMoodTags.tagId))
    .where(inArray(itemMoodTags.itemId, itemIds));

  const map = new Map<string, MoodTagRef[]>();
  for (const row of rows) {
    const existing = map.get(row.itemId) ?? [];
    existing.push({ id: row.tagId, name: row.tagName });
    map.set(row.itemId, existing);
  }
  return map;
}

async function attachTags(row: ItemRow): Promise<ItemWithTags> {
  const map = await fetchTagsForItems([row.id]);
  return { ...row, moodTags: map.get(row.id) ?? [] };
}

async function setTagsForItem(itemId: string, tagIds: number[]): Promise<void> {
  await db.delete(itemMoodTags).where(eq(itemMoodTags.itemId, itemId));
  if (tagIds.length > 0) {
    await db
      .insert(itemMoodTags)
      .values(tagIds.map((tagId) => ({ itemId, tagId })));
  }
}

// ── Active-limit helpers ─────────────────────────────────────────────────────

function pickLimit(
  s: { activeLimitGame: number; activeLimitAnime: number; activeLimitBook: number; activeLimitGunpla: number },
  type: ItemType,
): number {
  switch (type) {
    case 'game': return s.activeLimitGame;
    case 'anime': return s.activeLimitAnime;
    case 'book': return s.activeLimitBook;
    case 'gunpla': return s.activeLimitGunpla;
  }
}

async function checkActiveLimit(
  type: ItemType,
  excludeId?: string,
): Promise<{ exceeded: boolean; currentActiveCount: number; limit: number }> {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!s) throw new Error('Settings row missing — did you run db:seed?');
  const limit = pickLimit(s, type);

  const where = and(
    eq(items.type, type),
    eq(items.status, 'active'),
    excludeId ? ne(items.id, excludeId) : undefined,
  );
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items)
    .where(where);
  const currentActiveCount = row?.count ?? 0;

  return { exceeded: currentActiveCount >= limit, currentActiveCount, limit };
}

// ── Service results ──────────────────────────────────────────────────────────

export type CreateResult =
  | { kind: 'ok'; item: ItemWithTags }
  | ActiveLimitExceededResult;

export type UpdateResult =
  | { kind: 'ok'; item: ItemWithTags }
  | NotFoundResult
  | ActiveLimitExceededResult;

export type DeleteResult = { kind: 'ok' } | NotFoundResult;

// ── List ─────────────────────────────────────────────────────────────────────

export interface ListResult {
  items: ItemWithTags[];
  total: number;
  limit: number;
  offset: number;
}

export async function listItems(query: ItemListQuery): Promise<ListResult> {
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const sort = query.sort ?? 'recent';

  const where = and(
    query.type ? eq(items.type, query.type) : undefined,
    query.status ? eq(items.status, query.status) : undefined,
    query.search ? ilike(items.title, `%${query.search}%`) : undefined,
  );

  const orderBy = (() => {
    switch (sort) {
      case 'priority':   return [desc(items.priority), desc(items.createdAt)];
      case 'title':      return [asc(items.title)];
      case 'last_touched': return [desc(items.lastTouchedAt), desc(items.createdAt)];
      case 'recent':     return [desc(items.createdAt)];
    }
  })();

  const [rows, totalRow] = await Promise.all([
    db.select().from(items).where(where).orderBy(...orderBy).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(items).where(where),
  ]);

  const tagsMap = await fetchTagsForItems(rows.map((r) => r.id));
  const itemsWithTags = rows.map((r) => ({ ...r, moodTags: tagsMap.get(r.id) ?? [] }));

  return {
    items: itemsWithTags,
    total: totalRow[0]?.count ?? 0,
    limit,
    offset,
  };
}

// ── Get one ──────────────────────────────────────────────────────────────────

export async function getItem(id: string): Promise<ItemWithTags | null> {
  const [row] = await db.select().from(items).where(eq(items.id, id));
  if (!row) return null;
  return attachTags(row);
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createItem(input: ItemCreate, force: boolean): Promise<CreateResult> {
  const status = input.status ?? 'wishlist';
  const now = new Date();

  if (status === 'active' && !force) {
    const check = await checkActiveLimit(input.type);
    if (check.exceeded) {
      return {
        kind: 'active_limit_exceeded',
        type: input.type,
        currentActiveCount: check.currentActiveCount,
        limit: check.limit,
      };
    }
  }

  const insert: NewItem = {
    type: input.type,
    title: input.title,
    status,
    currentProgress: input.currentProgress ?? null,
    priority: input.priority ?? 3,
    timeCommitment: input.timeCommitment ?? null,
    mentalLoad: input.mentalLoad ?? null,
    coverUrl: input.coverUrl ?? null,
    externalId: input.externalId ?? null,
    externalSource: input.externalSource ?? null,
    metadata: input.metadata ?? null,
    notes: input.notes ?? null,
    rating: input.rating ?? null,
    startedAt: status === 'active' ? now : null,
    completedAt: status === 'completed' ? now : null,
  };

  const [row] = await db.insert(items).values(insert).returning();
  if (!row) throw new Error('Insert returned no row');

  if (input.moodTagIds && input.moodTagIds.length > 0) {
    await setTagsForItem(row.id, input.moodTagIds);
  }

  return { kind: 'ok', item: await attachTags(row) };
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateItem(
  id: string,
  patch: ItemUpdate,
  force: boolean,
): Promise<UpdateResult> {
  const current = await getItem(id);
  if (!current) return { kind: 'not_found' };

  if (patch.status === 'active' && current.status !== 'active' && !force) {
    const check = await checkActiveLimit(current.type, id);
    if (check.exceeded) {
      return {
        kind: 'active_limit_exceeded',
        type: current.type,
        currentActiveCount: check.currentActiveCount,
        limit: check.limit,
      };
    }
  }

  const now = new Date();
  const updates: Partial<NewItem> = {};

  if (patch.type !== undefined) updates.type = patch.type;
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.currentProgress !== undefined) updates.currentProgress = patch.currentProgress ?? null;
  if (patch.priority !== undefined) updates.priority = patch.priority;
  if (patch.timeCommitment !== undefined) updates.timeCommitment = patch.timeCommitment ?? null;
  if (patch.mentalLoad !== undefined) updates.mentalLoad = patch.mentalLoad ?? null;
  if (patch.coverUrl !== undefined) updates.coverUrl = patch.coverUrl ?? null;
  if (patch.externalId !== undefined) updates.externalId = patch.externalId ?? null;
  if (patch.externalSource !== undefined) updates.externalSource = patch.externalSource ?? null;
  if (patch.metadata !== undefined) updates.metadata = patch.metadata ?? null;
  if (patch.notes !== undefined) updates.notes = patch.notes ?? null;
  if (patch.rating !== undefined) updates.rating = patch.rating ?? null;

  const progressChanged =
    patch.currentProgress !== undefined && patch.currentProgress !== current.currentProgress;
  if (progressChanged) updates.lastTouchedAt = now;

  if (patch.status === 'active' && current.startedAt === null) updates.startedAt = now;
  if (patch.status === 'completed' && current.completedAt === null) updates.completedAt = now;

  // Update mood tags if provided (even [] = remove all)
  if (patch.moodTagIds !== undefined) {
    await setTagsForItem(id, patch.moodTagIds ?? []);
  }

  if (Object.keys(updates).length === 0) {
    // No column changes — still re-attach tags in case they changed
    return { kind: 'ok', item: await attachTags(current) };
  }

  const [row] = await db.update(items).set(updates).where(eq(items.id, id)).returning();
  if (!row) return { kind: 'not_found' };
  return { kind: 'ok', item: await attachTags(row) };
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteItem(id: string): Promise<DeleteResult> {
  const result = await db.delete(items).where(eq(items.id, id)).returning({ id: items.id });
  if (result.length === 0) return { kind: 'not_found' };
  return { kind: 'ok' };
}
