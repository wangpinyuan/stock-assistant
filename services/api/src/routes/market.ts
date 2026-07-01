import type { FastifyInstance } from 'fastify';
import { getMarketBreadth, getMarketIndexes, getMarketOverview, getMarketSectors } from '../services/marketService';

export async function marketRoutes(app: FastifyInstance) {
  app.get('/indexes', async () => getMarketIndexes());
  app.get('/breadth', async () => getMarketBreadth());
  app.get('/sectors', async () => getMarketSectors());
  app.get('/overview', async () => getMarketOverview());
}
