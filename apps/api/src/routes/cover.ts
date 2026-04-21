import { errorResponseSchema, idParamSchema, itemSchema } from '@hobby-track/shared';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { getItem } from '../services/items.js';
import { serializeItem } from '../lib/serialize.js';
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from '../lib/uploads.js';
import { AppError } from '../lib/errors.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_WIDTH = 1200;

/**
 * POST /api/items/:id/cover
 *
 * Accepts a single image file (jpeg/png/webp, max 5MB — enforced by the
 * multipart plugin) via the `cover` field. Processes it through sharp:
 *   - resize to ≤1200px wide (preserves aspect ratio, never upscales)
 *   - convert to webp at quality 85
 * Saves to uploads/<uuid>.webp, updates items.cover_url, deletes any previous
 * local cover.
 */
export const coverRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.post(
    '/:id/cover',
    {
      schema: {
        params: idParamSchema,
        response: {
          200: itemSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          413: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;

      const existing = await getItem(id);
      if (!existing) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Item not found' },
        });
      }

      const file = await req.file();
      if (!file) {
        return reply.code(400).send({
          error: { code: 'MISSING_FILE', message: 'No file uploaded. Send a multipart field named "cover".' },
        });
      }

      if (!ALLOWED_MIME.has(file.mimetype)) {
        // Must consume the stream or Fastify will hang
        await file.toBuffer();
        return reply.code(400).send({
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `Unsupported file type "${file.mimetype}". Allowed: jpeg, png, webp.`,
          },
        });
      }

      // Consume stream into buffer — @fastify/multipart enforces the 5MB
      // limit before this resolves, so we don't need a manual size check.
      let raw: Buffer;
      try {
        raw = await file.toBuffer();
      } catch (err) {
        // @fastify/multipart throws when the file exceeds limits.fileSize
        const isLimit = err instanceof Error && err.message.includes('Request file too large');
        if (isLimit) {
          return reply.code(413).send({
            error: { code: 'FILE_TOO_LARGE', message: 'File exceeds the 5 MB limit.' },
          });
        }
        throw err;
      }

      // Process with sharp
      let webpBuffer: Buffer;
      try {
        webpBuffer = await sharp(raw)
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw new AppError('IMAGE_PROCESSING_ERROR', 'Could not process image. Make sure it is a valid image file.', 400);
      }

      // Write to disk
      const filename = `${randomUUID()}.webp`;
      const filepath = path.join(UPLOADS_DIR, filename);
      await writeFile(filepath, webpBuffer);

      const newCoverUrl = `${UPLOADS_URL_PREFIX}${filename}`;

      // Update DB
      await db.update(items).set({ coverUrl: newCoverUrl }).where(eq(items.id, id));

      // Re-fetch with tags so serializeItem gets the full ItemWithTags shape
      const updated = await getItem(id);
      if (!updated) {
        // Shouldn't happen (we checked above), but clean up if so
        await unlink(filepath).catch(() => undefined);
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Item not found' },
        });
      }

      // Delete old local cover (best-effort — don't fail the request if it's gone)
      const oldCover = existing.coverUrl;
      if (oldCover?.startsWith(UPLOADS_URL_PREFIX)) {
        const oldFilename = oldCover.slice(UPLOADS_URL_PREFIX.length);
        const oldPath = path.join(UPLOADS_DIR, oldFilename);
        await unlink(oldPath).catch(() => undefined);
      }

      return serializeItem(updated);
    },
  );
};
