import {
  activeLimitErrorSchema,
  errorResponseSchema,
  forceQuerySchema,
  idParamSchema,
  itemCreateSchema,
  itemListQuerySchema,
  itemListResponseSchema,
  itemSchema,
  itemUpdateSchema,
} from '@hobby-track/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { serializeItem } from '../lib/serialize.js';
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from '../services/items.js';

export const itemsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // ── List ───────────────────────────────────────────────────────────────────
  app.get(
    '/',
    {
      schema: {
        querystring: itemListQuerySchema,
        response: {
          200: itemListResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (req) => {
      const result = await listItems(req.query);
      return {
        items: result.items.map(serializeItem),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      };
    },
  );

  // ── Create ────────────────────────────────────────────────────────────────
  app.post(
    '/',
    {
      schema: {
        body: itemCreateSchema,
        querystring: forceQuerySchema,
        response: {
          201: itemSchema,
          401: errorResponseSchema,
          409: activeLimitErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await createItem(req.body, req.query.force);
      if (result.kind === 'active_limit_exceeded') {
        return reply.code(409).send({
          error: {
            code: 'ACTIVE_LIMIT_EXCEEDED' as const,
            message: `Active limit reached for type "${result.type}" (${String(result.currentActiveCount)}/${String(result.limit)}). Pass ?force=true to override.`,
            details: {
              type: result.type,
              currentActiveCount: result.currentActiveCount,
              limit: result.limit,
            },
          },
        });
      }
      return reply.code(201).send(serializeItem(result.item));
    },
  );

  // ── Get one ───────────────────────────────────────────────────────────────
  app.get(
    '/:id',
    {
      schema: {
        params: idParamSchema,
        response: {
          200: itemSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const row = await getItem(req.params.id);
      if (!row) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Item not found' },
        });
      }
      return serializeItem(row);
    },
  );

  // ── Update ────────────────────────────────────────────────────────────────
  app.patch(
    '/:id',
    {
      schema: {
        params: idParamSchema,
        querystring: forceQuerySchema,
        body: itemUpdateSchema,
        response: {
          200: itemSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: activeLimitErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await updateItem(req.params.id, req.body, req.query.force);
      if (result.kind === 'not_found') {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Item not found' },
        });
      }
      if (result.kind === 'active_limit_exceeded') {
        return reply.code(409).send({
          error: {
            code: 'ACTIVE_LIMIT_EXCEEDED' as const,
            message: `Active limit reached for type "${result.type}" (${String(result.currentActiveCount)}/${String(result.limit)}). Pass ?force=true to override.`,
            details: {
              type: result.type,
              currentActiveCount: result.currentActiveCount,
              limit: result.limit,
            },
          },
        });
      }
      return serializeItem(result.item);
    },
  );

  // ── Delete ────────────────────────────────────────────────────────────────
  app.delete(
    '/:id',
    {
      schema: {
        params: idParamSchema,
        response: {
          204: z.null(),
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await deleteItem(req.params.id);
      if (result.kind === 'not_found') {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Item not found' },
        });
      }
      return reply.code(204).send(null);
    },
  );
};
