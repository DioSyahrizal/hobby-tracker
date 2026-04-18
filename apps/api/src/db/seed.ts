import { db } from './index.js';
import { settings } from './schema.js';

async function seed(): Promise<void> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  console.log('Seed complete: settings row ensured');
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
