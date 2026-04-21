import { db } from './index.js';
import { moodTags, settings } from './schema.js';

const SEED_TAGS = [
  // ── Originals (tonight-page presets) ──────────────────────────────────────
  'cozy', 'chill', 'intense', 'action',
  'story', 'hands-on', 'casual', 'epic',

  // ── Game ──────────────────────────────────────────────────────────────────
  'rpg', 'strategy', 'shooter', 'platformer',
  'puzzle', 'horror', 'adventure', 'open-world',
  'competitive', 'indie', 'stealth', 'survival',

  // ── Anime ─────────────────────────────────────────────────────────────────
  'slice-of-life', 'shounen', 'romance', 'fantasy',
  'sci-fi', 'thriller', 'comedy', 'drama',
  'mecha', 'isekai', 'sports', 'psychological',

  // ── Book ──────────────────────────────────────────────────────────────────
  'mystery', 'non-fiction', 'self-help', 'historical',
  'biography', 'literary', 'dark', 'uplifting',
  'fast-paced', 'thought-provoking',
];

async function seed(): Promise<void> {
  // Settings row — always ensure it exists
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  console.log('Seed complete: settings row ensured');

  // Mood tags — insert new ones, skip duplicates
  if (SEED_TAGS.length > 0) {
    await db
      .insert(moodTags)
      .values(SEED_TAGS.map((name) => ({ name })))
      .onConflictDoNothing();
    console.log(`Seed complete: ${String(SEED_TAGS.length)} mood tags ensured`);
  }
}

seed()
  .then(() => { process.exit(0); })
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
