import {
  errorResponseSchema,
  recommendRequestSchema,
  recommendResponseSchema,
} from '@hobby-track/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { listItems } from '../services/items.js';
import { scoreItem } from '../services/recommend.js';

export const recommendRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * POST /api/recommend
   *
   * Given the user's current state (time, energy, optional mood), score all
   * active items and return the top 5 matches with a score breakdown and
   * human-readable reasons.
   */
  app.post(
    '/',
    {
      onRequest: app.authenticate,
      schema: {
        body: recommendRequestSchema,
        response: {
          200: recommendResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (req) => {
      // Fetch all active items (using a generous limit — personal tool)
      const { items } = await listItems({ status: 'active', limit: 200 });

      const scored = items
        .map((item) => scoreItem(item, req.body))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return { results: scored };
    },
  );
};
