import type { SearchResponse, SearchResult } from '@hobby-track/shared';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { LruCache } from '../../lib/cache.js';
import { AppError } from '../../lib/errors.js';
import { fetchJson } from '../../lib/http.js';

/**
 * RAWG (https://rawg.io) — free games database. Requires API key.
 *   GET https://api.rawg.io/api/games?key=KEY&search=Q&page_size=N
 */

const rawgGameSchema = z.object({
  id: z.number(),
  slug: z.string().nullish(),
  name: z.string(),
  released: z.string().nullish(),
  background_image: z.url().nullish(),
  rating: z.number().nullish(),
  platforms: z
    .array(z.object({ platform: z.object({ name: z.string() }) }))
    .nullish(),
  genres: z.array(z.object({ name: z.string() })).nullish(),
});

const rawgResponseSchema = z.object({
  results: z.array(rawgGameSchema),
});

const cache = new LruCache<string, SearchResult[]>();

export async function searchGames(q: string, limit = 10): Promise<SearchResponse> {
  if (!env.RAWG_API_KEY) {
    throw new AppError(
      'UPSTREAM_NOT_CONFIGURED',
      'RAWG_API_KEY is not set. Add it to .env to enable game search.',
      503,
    );
  }

  const key = `${q.toLowerCase()}::${String(limit)}`;
  const cached = cache.get(key);
  if (cached) return { results: cached, cached: true };

  const url = new URL('https://api.rawg.io/api/games');
  url.searchParams.set('key', env.RAWG_API_KEY);
  url.searchParams.set('search', q);
  url.searchParams.set('page_size', String(limit));

  const raw = await fetchJson(url.toString(), { upstream: 'RAWG' });
  const parsed = rawgResponseSchema.parse(raw);

  const results: SearchResult[] = parsed.results.map((g) => {
    const year = g.released ? Number(g.released.slice(0, 4)) : null;
    const platforms = g.platforms?.map((p) => p.platform.name) ?? [];
    const genres = g.genres?.map((x) => x.name) ?? [];
    return {
      source: 'rawg',
      externalId: String(g.id),
      type: 'game',
      title: g.name,
      coverUrl: g.background_image ?? null,
      releaseYear: year && !Number.isNaN(year) ? year : null,
      // RAWG search results don't include description; user gets it from detail
      // page later (out of scope for v1 — they can edit notes manually).
      description: null,
      metadata: {
        slug: g.slug ?? null,
        rating: g.rating ?? null,
        platforms,
        genres,
      },
    };
  });

  cache.set(key, results);
  return { results, cached: false };
}
