import fastifyMultipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Registers @fastify/multipart globally so any route can accept
 * multipart/form-data. Limits are enforced here rather than per-route.
 *
 *   File size:  5 MB
 *   File count: 1 per request (cover upload only ever sends one)
 *   Fields:     2 (just in case any metadata ever accompanies the file)
 */
export const multipartPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
      files: 1,
      fields: 2,
    },
  });
});
