import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getHoldingsImpactNews,
  getNewsTypes,
  getStockNews,
  listNews
} from './service';

export async function newsRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const input = z.object({ type: z.string().max(50).optional(), limit: z.coerce.number().int().min(1).max(500).optional() }).parse(request.query);
    return listNews(input);
  });
  app.get('/types', async () => getNewsTypes());
  app.get('/holdings-impact', async () => getHoldingsImpactNews());
  app.get('/stocks/:code', async (request) =>
    getStockNews((request.params as { code: string }).code)
  );
}
