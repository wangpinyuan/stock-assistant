import type { FastifyInstance } from 'fastify';
import { getMarketBreadth, getMarketIndexes, getMarketOverview, getMarketSectors, getBreadthStocks } from '../services/marketService';

export async function marketRoutes(app: FastifyInstance) {
  app.get('/indexes', async () => getMarketIndexes());
  app.get('/breadth', async () => getMarketBreadth());
  app.get('/sectors', async () => getMarketSectors());
  app.get('/overview', async () => getMarketOverview());
  app.get('/limit-up', async () => getBreadthStocks('limitUp'));
  app.get('/limit-down', async () => getBreadthStocks('limitDown'));
  app.get('/strong', async () => getBreadthStocks('strong'));
  app.get('/weak', async () => getBreadthStocks('weak'));
}
