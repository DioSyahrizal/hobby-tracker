import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const itemTypeEnum = pgEnum('item_type', ['game', 'anime', 'book', 'gunpla']);
export const itemStatusEnum = pgEnum('item_status', [
  'wishlist',
  'active',
  'paused',
  'completed',
  'dropped',
]);
export const timeCommitmentEnum = pgEnum('time_commitment', [
  'short',
  'medium',
  'long',
  'very_long',
]);
export const mentalLoadEnum = pgEnum('mental_load', ['light', 'medium', 'heavy']);

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: itemTypeEnum('type').notNull(),
    title: text('title').notNull(),
    status: itemStatusEnum('status').notNull().default('wishlist'),
    currentProgress: text('current_progress'),
    priority: integer('priority').notNull().default(3),
    timeCommitment: timeCommitmentEnum('time_commitment'),
    mentalLoad: mentalLoadEnum('mental_load'),
    coverUrl: text('cover_url'),
    externalId: text('external_id'),
    externalSource: text('external_source'),
    metadata: jsonb('metadata'),
    notes: text('notes'),
    rating: integer('rating'),
    lastTouchedAt: timestamp('last_touched_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('items_type_status_idx').on(t.type, t.status),
    index('items_last_touched_idx').on(t.lastTouchedAt),
    index('items_priority_idx').on(t.priority.desc()),
  ],
);

// ── Mood tags ─────────────────────────────────────────────────────────────────

export const moodTags = pgTable('mood_tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const itemMoodTags = pgTable(
  'item_mood_tags',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => moodTags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] })],
);

// ── Settings ──────────────────────────────────────────────────────────────────

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  activeLimitGame: integer('active_limit_game').notNull().default(3),
  activeLimitAnime: integer('active_limit_anime').notNull().default(3),
  activeLimitBook: integer('active_limit_book').notNull().default(2),
  activeLimitGunpla: integer('active_limit_gunpla').notNull().default(5),
  theme: text('theme').notNull().default('system'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type MoodTagRow = typeof moodTags.$inferSelect;
export type Settings = typeof settings.$inferSelect;
