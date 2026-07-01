import type { FastifyInstance } from 'fastify';
import {
  getMarketFundFlow,
  getPortfolioFundFlow,
  getSectorFundFlow,
  getStockFundFlow,
  getWatchlistFundFlow
} from '../services/fundFlowService';

export async function fundFlowRoutes(app: FastifyInstance) {
  app.get('/market', async () => getMarketFundFlow());
  app.get('/sectors', async () => getSectorFundFlow());
  app.get('/stocks/:code', async (request) =>
    getStockFundFlow((request.params as { code: string }).code)
  );
  app.get('/portfolio', async () => getPortfolioFundFlow());
  app.get('/watchlist', async () => getWatchlistFundFlow());
}
