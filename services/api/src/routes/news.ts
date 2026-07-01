import type { FastifyInstance } from 'fastify';
import {
  getHoldingsImpactNews,
  getNewsTypes,
  getStockNews,
  listNews
} from '../services/newsService';

export async function newsRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const { type, limit } = request.query as { type?: string; limit?: string };
    return listNews({ type, limit: limit ? Number(limit) : undefined });
  });
  app.get('/types', async () => getNewsTypes());
  app.get('/holdings-impact', async () => getHoldingsImpactNews());
  app.get('/stocks/:code', async (request) =>
    getStockNews((request.params as { code: string }).code)
  );
}
