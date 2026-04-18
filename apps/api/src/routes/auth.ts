import { loginSchema } from '@hobby-track/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AUTH_COOKIE } from '../plugins/auth.js';

const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/login',
    {
      schema: {
        body: loginSchema,
        response: {
          200: z.object({ ok: z.literal(true) }),
          401: errorResponse,
        },
      },
    },
    async (req, reply) => {
      if (req.body.password !== env.APP_PASSWORD) {
        return reply.code(401).send({
          error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' },
        });
      }

      const token = app.jwt.sign({ sub: 'owner' }, { expiresIn: '30d' });

      reply.setCookie(AUTH_COOKIE, token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });

      return { ok: true as const };
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        response: {
          200: z.object({ ok: z.literal(true) }),
        },
      },
    },
    async (_req, reply) => {
      reply.clearCookie(AUTH_COOKIE, { path: '/' });
      return { ok: true as const };
    },
  );

  app.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        response: {
          200: z.object({ authenticated: z.literal(true) }),
          401: errorResponse,
        },
      },
    },
    async () => ({ authenticated: true as const }),
  );
};
