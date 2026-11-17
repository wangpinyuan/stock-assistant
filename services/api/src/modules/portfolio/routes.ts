import type { FastifyInstance } from 'fastify';
import { getPortfolioSummary } from './service';

export async function portfolioRoutes(app: FastifyInstance) {
  app.get('/summary', async () => getPortfolioSummary());

  app.get('/snapshots', async (_request, reply) => reply.code(501).send({ ok: false, error: '组合快照尚未实现' }));
}
