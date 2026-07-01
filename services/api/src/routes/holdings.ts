import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createHolding,
  deleteHolding,
  getHoldings,
  getHoldingById,
  updateHolding
} from '../services/holdingService';
import { runWorker } from '../services/workerRunner';

const holdingInputSchema = z.object({
  code: z.string().trim().min(1).max(20),
  quantity: z.number().positive(),
  averageCost: z.number().nonnegative(),
  assetType: z.enum(['stock', 'etf']).default('stock'),
  buyDate: z.string().nullish(),
  tags: z.string().max(200).nullish(),
  note: z.string().max(1000).nullish()
});

const holdingUpdateSchema = holdingInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '至少提供一个可更新字段' }
);

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

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
    runWorker({ script: 'update_quotes.py', args: ['--codes', input.code] });
    reply.code(201);
    return { ok: true, ...result };
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
