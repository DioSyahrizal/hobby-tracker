import type { SearchResponse, SearchResult } from '@hobby-track/shared';
import { z } from 'zod';
import { LruCache } from '../../lib/cache.js';
import { fetchJson } from '../../lib/http.js';
import { IntervalLimiter } from '../../lib/rate-limiter.js';

/**
 * Jikan (https://jikan.moe) — unofficial MyAnimeList REST API. No auth.
 *   GET https://api.jikan.moe/v4/anime?q=Q&limit=N
 *
 * Free tier: 3 req/sec, 60 req/min. We gate at ~350ms between calls (slightly
 * over 1/3s) to leave headroom for clock skew and retries.
 */

const jikanAnimeSchema = z.object({
  mal_id: z.number(),
  title: z.string(),
  title_english: z.string().nullish(),
  synopsis: z.string().nullish(),
  type: z.string().nullish(),
  episodes: z.number().nullish(),
  score: z.number().nullish(),
  status: z.string().nullish(),
  aired: z.object({ from: z.string().nullish() }).nullish(),
  images: z
    .object({
      jpg: z
        .object({
          image_url: z.url().nullish(),
          large_image_url: z.url().nullish(),
        })
        .nullish(),
    })
    .nullish(),
  genres: z.array(z.object({ name: z.string() })).nullish(),
});

const jikanResponseSchema = z.object({
  data: z.array(jikanAnimeSchema),
});

const cache = new LruCache<string, SearchResult[]>();
const limiter = new IntervalLimiter(350);

export async function searchAnime(q: string, limit = 10): Promise<SearchResponse> {
  const key = `${q.toLowerCase()}::${String(limit)}`;
  const cached = cache.get(key);
  if (cached) return { results: cached, cached: true };

  const url = new URL('https://api.jikan.moe/v4/anime');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));

  await limiter.acquire();
  const raw = await fetchJson(url.toString(), { upstream: 'Jikan' });
  const parsed = jikanResponseSchema.parse(raw);

  const results: SearchResult[] = parsed.data.map((a) => {
    const year = a.aired?.from ? Number(a.aired.from.slice(0, 4)) : null;
    const cover =
      a.images?.jpg?.large_image_url ?? a.images?.jpg?.image_url ?? null;
    const genres = a.genres?.map((g) => g.name) ?? [];
    return {
      source: 'jikan',
      externalId: String(a.mal_id),
      type: 'anime',
      title: a.title_english ?? a.title,
      coverUrl: cover,
      releaseYear: year && !Number.isNaN(year) ? year : null,
      description: a.synopsis ?? null,
      metadata: {
        originalTitle: a.title,
        type: a.type ?? null,
        episodes: a.episodes ?? null,
        score: a.score ?? null,
        status: a.status ?? null,
        genres,
      },
    };
  });

  cache.set(key, results);
  return { results, cached: false };
}
