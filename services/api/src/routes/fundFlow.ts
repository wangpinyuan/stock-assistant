import type { FastifyInstance } from 'fastify';

export async function fundFlowRoutes(app: FastifyInstance) {
  app.get('/market', async () => ({ items: [] }));
  app.get('/sectors', async () => ({ items: [] }));
  app.get('/stocks/:code', async () => ({ items: [] }));
  app.get('/portfolio', async () => ({ items: [] }));
  app.get('/watchlist', async () => ({ items: [] }));
}
