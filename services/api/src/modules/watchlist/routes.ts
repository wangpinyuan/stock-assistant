import { watchlistInputSchema, watchlistUpdateSchema, idParamSchema } from './schema';
import type { FastifyInstance } from 'fastify';
import {
  createWatchlistItem,
  deleteWatchlistItem,
  getWatchlist,
  updateWatchlistItem
} from './service';
import { runWorker } from '../../infrastructure/workerRunner';

export async function watchlistRoutes(app: FastifyInstance) {
  app.get('/', async () => getWatchlist());

  app.post('/', async (request, reply) => {
    const input = watchlistInputSchema.parse(request.body);
    const result = await createWatchlistItem(input);
    const update = result.duplicate ? undefined : await runWorker({ script: 'update_quotes.py', args: ['--codes', input.code] });
    reply.code(result.duplicate ? 200 : 201);
    return { ok: true, ...result, update };
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
