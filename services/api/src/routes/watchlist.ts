import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createWatchlistItem,
  deleteWatchlistItem,
  getWatchlist,
  updateWatchlistItem
} from '../services/watchlistService';
import { runWorker } from '../services/workerRunner';

const watchlistInputSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
  note: z.string().max(500).nullish()
});

const watchlistUpdateSchema = z
  .object({
    sortOrder: z.number().int().optional(),
    note: z.string().max(500).nullish()
  })
  .refine((value) => Object.keys(value).length > 0, { message: '至少提供一个可更新字段' });

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export async function watchlistRoutes(app: FastifyInstance) {
  app.get('/', async () => getWatchlist());

  app.post('/', async (request, reply) => {
    const input = watchlistInputSchema.parse(request.body);
    const result = await createWatchlistItem(input);
    if (!result.duplicate) {
      runWorker({ script: 'update_quotes.py', args: ['--codes', input.code] });
    }
    reply.code(result.duplicate ? 200 : 201);
    return { ok: true, ...result };
  });

  app.put('/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = watchlistUpdateSchema.parse(request.body);
    const result = await updateWatchlistItem(id, input);
    if (!result) {
      reply.code(404);
      return { error: '自选不存在' };
    }
    return { ok: true, ...result };
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const result = await deleteWatchlistItem(id);
    if (!result) {
      reply.code(404);
      return { error: '自选不存在' };
    }
    return { ok: true, ...result };
  });
}
