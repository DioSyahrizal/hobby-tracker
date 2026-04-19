import type { SettingsUpdate } from '@hobby-track/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { settings, type Settings as SettingsRow } from '../db/schema.js';

export async function getSettings(): Promise<SettingsRow> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!row) {
    throw new Error('Settings row missing — did you run db:seed?');
  }
  return row;
}

export async function updateSettings(patch: SettingsUpdate): Promise<SettingsRow> {
  if (Object.keys(patch).length === 0) {
    return getSettings();
  }
  const [row] = await db.update(settings).set(patch).where(eq(settings.id, 1)).returning();
  if (!row) {
    throw new Error('Settings row missing — did you run db:seed?');
  }
  return row;
}
