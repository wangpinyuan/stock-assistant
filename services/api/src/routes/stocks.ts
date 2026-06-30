import type { FastifyInstance } from 'fastify';
import { getStockDetail, getStockKline, getStockNews, getStockQuote } from '../services/stockService';

export async function stocksRoutes(app: FastifyInstance) {
  app.get('/:code', async (request) => getStockDetail((request.params as { code: string }).code));

  app.get('/:code/quote', async (request) => getStockQuote((request.params as { code: string }).code));

  app.get('/:code/kline', async (request) => {
    const { code } = request.params as { code: string };
    const { period = 'daily' } = request.query as { period?: string };
    return getStockKline(code, period);
  });

  app.get('/:code/fund-flow', async () => ({ items: [] }));

  app.get('/:code/news', async (request) => getStockNews((request.params as { code: string }).code));

  app.get('/:code/analysis-signals', async () => ({ signals: [] }));
}
