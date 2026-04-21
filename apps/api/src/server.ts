import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import { UPLOADS_DIR } from './lib/uploads.js';
import { authPlugin } from './plugins/auth.js';
import { multipartPlugin } from './plugins/multipart.js';
import { authRoutes } from './routes/auth.js';
import { coverRoutes } from './routes/cover.js';
import { itemsRoutes } from './routes/items.js';
import { recommendRoutes } from './routes/recommend.js';
import { searchRoutes } from './routes/search.js';
import { settingsRoutes } from './routes/settings.js';

/**
 * Absolute path to the Vite SPA build output (apps/web/dist).
 * Computed from this file's compiled location (apps/api/dist/server.js)
 * so it resolves correctly in both `tsx` dev and compiled production.
 *
 *   apps/api/dist/server.js  →  ../../web/dist  →  apps/web/dist
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, '..', '..', 'web', 'dist');

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- upstream type uses $ZodType from zod/v4/core which typescript-eslint can't fully resolve; tsc accepts it
  app.setSerializerCompiler(serializerCompiler);

  // Standardize error response shape: { error: { code, message, details? } }
  app.setErrorHandler((error: FastifyError, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request failed validation',
          details: error.validation,
        },
      });
    }

    // Intentional, typed errors thrown by services (e.g. UPSTREAM_ERROR from
    // an external-API client). Expose code+message verbatim, even at 5xx —
    // the AppError contract is "this is meant to be seen by the client."
    if (error instanceof AppError) {
      if (error.statusCode >= 500) req.log.warn(error);
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      req.log.error(error);
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }

    return reply.code(statusCode).send({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  });

  // ── Static file serving ────────────────────────────────────────────────────

  if (env.NODE_ENV === 'production') {
    // 1. Serve the compiled Vite SPA from apps/web/dist.
    //    decorateReply: true (default) adds reply.sendFile() — needed for the
    //    SPA fallback below. Must be registered before the uploads root.
    await app.register(fastifyStatic, {
      root: WEB_DIST,
      prefix: '/',
    });
  }

  // 2. Serve uploaded images at /uploads/:filename.
  //    In development: this is the only static registration.
  //    In production:  decorateReply: false — sendFile already decorated above.
  await app.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
    decorateReply: env.NODE_ENV !== 'production',
  });

  // ── API routes ─────────────────────────────────────────────────────────────

  await app.register(authPlugin);
  await app.register(multipartPlugin);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(itemsRoutes, { prefix: '/api/items' });
  await app.register(coverRoutes, { prefix: '/api/items' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  await app.register(settingsRoutes, { prefix: '/api/settings' });
  await app.register(recommendRoutes, { prefix: '/api/recommend' });

  app.get('/api/health', async () => ({ status: 'ok' }));

  // ── SPA fallback (production only) ─────────────────────────────────────────
  // Any request that didn't match an API route or a static asset gets
  // index.html so client-side routing works on hard refresh / direct URL.
  if (env.NODE_ENV === 'production') {
    app.setNotFoundHandler(async (_req, reply) => {
      await reply.sendFile('index.html');
    });
  }

  return app;
}

async function main(): Promise<void> {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
