import type { FastifyInstance } from 'fastify';
import {
  getStockAnalysisSignals,
  getStockDetail,
  getStockKline,
  getStockQuote
} from '../services/stockService';
import { getStockNews } from '../services/newsService';
import { getFundFlowByLevel } from '../services/fundFlowService';

export async function stocksRoutes(app: FastifyInstance) {
  app.get('/:code', async (request) => getStockDetail((request.params as { code: string }).code));

  app.get('/:code/quote', async (request) => getStockQuote((request.params as { code: string }).code));

  app.get('/:code/kline', async (request) => {
    const { code } = request.params as { code: string };
    const { period = 'daily', before } = request.query as { period?: string; before?: string };
    return getStockKline(code, period, before);
  });

  app.get('/:code/fund-flow', async (request) =>
    getFundFlowByLevel('stock', 30)
  );

  app.get('/:code/news', async (request) => getStockNews((request.params as { code: string }).code));

  app.get('/:code/analysis-signals', async (request) =>
    getStockAnalysisSignals((request.params as { code: string }).code)
  );
}
