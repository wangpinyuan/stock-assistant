import type { FastifyInstance } from 'fastify';
import { getPortfolioSummary } from '../services/portfolioService';

export async function portfolioRoutes(app: FastifyInstance) {
  app.get('/summary', async () => getPortfolioSummary());

  app.get('/snapshots', async () => ({ items: [] }));
}
