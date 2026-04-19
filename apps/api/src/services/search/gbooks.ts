import type { SearchResponse, SearchResult } from '@hobby-track/shared';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { LruCache } from '../../lib/cache.js';
import { fetchJson } from '../../lib/http.js';

/**
 * Google Books (https://developers.google.com/books). No auth required for
 * basic search (1000 req/day shared quota); pass GOOGLE_BOOKS_API_KEY for a
 * private quota.
 *   GET https://www.googleapis.com/books/v1/volumes?q=Q&maxResults=N
 */

const gbooksVolumeSchema = z.object({
  id: z.string(),
  volumeInfo: z
    .object({
      title: z.string().nullish(),
      authors: z.array(z.string()).nullish(),
      publishedDate: z.string().nullish(),
      description: z.string().nullish(),
      pageCount: z.number().nullish(),
      publisher: z.string().nullish(),
      categories: z.array(z.string()).nullish(),
      imageLinks: z
        .object({
          smallThumbnail: z.string().nullish(),
          thumbnail: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

const gbooksResponseSchema = z.object({
  // Google omits the field entirely on zero results — accept missing/empty.
  items: z.array(gbooksVolumeSchema).nullish(),
});

const cache = new LruCache<string, SearchResult[]>();

export async function searchBooks(q: string, limit = 10): Promise<SearchResponse> {
  const key = `${q.toLowerCase()}::${String(limit)}`;
  const cached = cache.get(key);
  if (cached) return { results: cached, cached: true };

  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', q);
  url.searchParams.set('maxResults', String(limit));
  if (env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set('key', env.GOOGLE_BOOKS_API_KEY);
  }

  const raw = await fetchJson(url.toString(), { upstream: 'Google Books' });
  const parsed = gbooksResponseSchema.parse(raw);

  const results: SearchResult[] = (parsed.items ?? []).map((vol) => {
    const info = vol.volumeInfo;
    const title = info?.title ?? '(untitled)';
    const year = info?.publishedDate
      ? Number(info.publishedDate.slice(0, 4))
      : null;
    // Google still serves http:// thumbnails — upgrade so they don't get
    // blocked as mixed content from an https frontend.
    const rawCover = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail ?? null;
    const cover = rawCover ? rawCover.replace(/^http:\/\//, 'https://') : null;

    return {
      source: 'gbooks',
      externalId: vol.id,
      type: 'book',
      title,
      coverUrl: cover,
      releaseYear: year && !Number.isNaN(year) ? year : null,
      description: info?.description ?? null,
      metadata: {
        authors: info?.authors ?? [],
        publisher: info?.publisher ?? null,
        pageCount: info?.pageCount ?? null,
        categories: info?.categories ?? [],
      },
    };
  });

  cache.set(key, results);
  return { results, cached: false };
}
