import type { FastifyInstance } from 'fastify';

export async function newsRoutes(app: FastifyInstance) {
  app.get('/', async () => ({ items: [] }));
  app.get('/holdings-impact', async () => ({ items: [] }));
  app.get('/stocks/:code', async () => ({ items: [] }));
}
