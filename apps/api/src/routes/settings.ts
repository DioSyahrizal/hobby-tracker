import {
  errorResponseSchema,
  settingsSchema,
  settingsUpdateSchema,
} from '@hobby-track/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { serializeSettings } from '../lib/serialize.js';
import { getSettings, updateSettings } from '../services/settings.js';

export const settingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        response: {
          200: settingsSchema,
          401: errorResponseSchema,
        },
      },
    },
    async () => serializeSettings(await getSettings()),
  );

  app.patch(
    '/',
    {
      schema: {
        body: settingsUpdateSchema,
        response: {
          200: settingsSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (req) => serializeSettings(await updateSettings(req.body)),
  );
};
