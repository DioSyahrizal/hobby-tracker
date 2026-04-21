import {
  createMoodTagSchema,
  errorResponseSchema,
  moodTagSchema,
  moodTagsResponseSchema,
} from '@hobby-track/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createMoodTag, listMoodTags } from '../services/mood-tags.js';

export const moodTagsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  /** GET /api/mood-tags — full list, alphabetical */
  app.get(
    '/',
    {
      schema: {
        response: {
          200: moodTagsResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async () => {
      const tags = await listMoodTags();
      return { tags: tags.map((t) => ({ id: t.id, name: t.name })) };
    },
  );

  /** POST /api/mood-tags — create (idempotent: returns existing if name taken) */
  app.post(
    '/',
    {
      schema: {
        body: createMoodTagSchema,
        response: {
          200: moodTagSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const tag = await createMoodTag(req.body.name);
      return { id: tag.id, name: tag.name };
    },
  );
};
