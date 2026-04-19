/**
 * DEV-ONLY: wipe all items and reset settings to defaults.
 * Useful before running the Postman collection from a clean slate.
 *
 *   pnpm tsx --env-file=.env src/db/reset-dev.ts
 */
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { items, settings } from './schema.js';

async function reset(): Promise<void> {
  const deleted = await db.delete(items).returning({ id: items.id });
  console.log(`Deleted ${String(deleted.length)} items`);

  await db
    .update(settings)
    .set({
      activeLimitGame: 3,
      activeLimitAnime: 3,
      activeLimitBook: 2,
      activeLimitGunpla: 5,
      theme: 'system',
    })
    .where(eq(settings.id, 1));
  console.log('Settings reset to defaults');
}

reset()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
