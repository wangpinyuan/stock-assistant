import type { FastifyInstance } from 'fastify';
import {
  getMarketFundFlow,
  getPortfolioFundFlow,
  getSectorFundFlow,
  getSectorOutflowFundFlow,
  getStockFundFlow,
  getWatchlistFundFlow,
  getFundFlowByLevel
} from '../services/fundFlowService';

export async function fundFlowRoutes(app: FastifyInstance) {
  app.get('/market', async () => getMarketFundFlow());
  app.get('/sectors', async () => getSectorFundFlow());
  app.get('/sector-outflows', async () => getSectorOutflowFundFlow());
  app.get('/stocks/:code', async (request) =>
    getStockFundFlow((request.params as { code: string }).code)
  );
  app.get('/portfolio', async () => getPortfolioFundFlow());
  app.get('/watchlist', async () => getWatchlistFundFlow());
  app.get('/inflows', async () => getFundFlowByLevel('stock_inflow'));
  app.get('/outflows', async () => getFundFlowByLevel('stock_outflow'));
}
