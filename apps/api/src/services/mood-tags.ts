import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { moodTags, type MoodTagRow } from '../db/schema.js';
import { AppError } from '../lib/errors.js';

export async function listMoodTags(): Promise<MoodTagRow[]> {
  return db.select().from(moodTags).orderBy(moodTags.name);
}

export async function createMoodTag(name: string): Promise<MoodTagRow> {
  const trimmed = name.trim();

  const [existing] = await db
    .select()
    .from(moodTags)
    .where(eq(moodTags.name, trimmed));
  if (existing) return existing;

  const [row] = await db.insert(moodTags).values({ name: trimmed }).returning();
  if (!row) throw new AppError('INTERNAL_ERROR', 'Failed to create mood tag');
  return row;
}
