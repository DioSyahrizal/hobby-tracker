import {
  errorResponseSchema,
  searchQuerySchema,
  searchResponseSchema,
} from '@hobby-track/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { searchBooks } from '../services/search/gbooks.js';
import { searchAnime } from '../services/search/jikan.js';
import { searchGames } from '../services/search/rawg.js';

/**
 * Proxies to external metadata APIs. All routes:
 *   - require auth
 *   - validate `?q=` (1-200 chars) and optional `?limit=` (1-20)
 *   - return a normalized { results, cached } payload
 *   - surface upstream failures as 502 UPSTREAM_ERROR via the global handler
 *   - surface missing API keys as 503 UPSTREAM_NOT_CONFIGURED (RAWG only)
 *
 * Gunpla is intentionally absent — no good third-party API exists, so users
 * enter those manually with image upload (Phase 4).
 */
export const searchRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/games',
    {
      schema: {
        querystring: searchQuerySchema,
        response: {
          200: searchResponseSchema,
          401: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (req) => {
      return await searchGames(req.query.q, req.query.limit);
    },
  );

  app.get(
    '/anime',
    {
      schema: {
        querystring: searchQuerySchema,
        response: {
          200: searchResponseSchema,
          401: errorResponseSchema,
          502: errorResponseSchema,
        },
      },
    },
    async (req) => {
      return await searchAnime(req.query.q, req.query.limit);
    },
  );

  app.get(
    '/books',
    {
      schema: {
        querystring: searchQuerySchema,
        response: {
          200: searchResponseSchema,
          401: errorResponseSchema,
          502: errorResponseSchema,
        },
      },
    },
    async (req) => {
      return await searchBooks(req.query.q, req.query.limit);
    },
  );
};
