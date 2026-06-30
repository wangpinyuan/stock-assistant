import type { FastifyInstance } from 'fastify';

export async function aiRoutes(app: FastifyInstance) {
  app.post('/analyze/stock/:code', async () => ({ ok: true, message: 'Stock AI analysis will be implemented after data signals are ready.' }));
  app.post('/analyze/portfolio', async () => ({ ok: true, message: 'Portfolio AI analysis will be implemented after data signals are ready.' }));
  app.post('/analyze/market', async () => ({ ok: true, message: 'Market AI analysis will be implemented after data signals are ready.' }));
  app.get('/reports', async () => ({ items: [] }));
  app.get('/reports/:id', async () => ({ item: null }));
}
