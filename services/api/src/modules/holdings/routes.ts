import { holdingInputSchema, holdingUpdateSchema, idParamSchema } from './schema';
import type { FastifyInstance } from 'fastify';
import {
  createHolding,
  deleteHolding,
  getHoldings,
  getHoldingById,
  updateHolding
} from './service';
import { runWorker } from '../../infrastructure/workerRunner';

export async function holdingsRoutes(app: FastifyInstance) {
  app.get('/', async () => getHoldings());

  app.get('/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const item = await getHoldingById(id);
    if (!item) {
      reply.code(404);
      return { error: '持仓不存在' };
    }
    return { item };
  });

  app.post('/', async (request, reply) => {
    const input = holdingInputSchema.parse(request.body);
    const result = await createHolding(input);
    const update = await runWorker({ script: 'update_quotes.py', args: ['--codes', input.code] });
    reply.code(201);
    return { ok: true, ...result, update };
  });

  app.put('/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const input = holdingUpdateSchema.parse(request.body);
    const result = await updateHolding(id, input);
    if (!result) {
      reply.code(404);
      return { error: '持仓不存在' };
    }
    return { ok: true, ...result };
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const result = await deleteHolding(id);
    if (!result) {
      reply.code(404);
      return { error: '持仓不存在' };
    }
    return { ok: true, ...result };
  });
}
