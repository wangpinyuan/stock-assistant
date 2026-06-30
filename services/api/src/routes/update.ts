import type { FastifyInstance } from 'fastify';

export async function updateRoutes(app: FastifyInstance) {
  app.post('/quotes', async () => ({ ok: true, message: 'Quote update worker will be connected in the next milestone.' }));
  app.post('/holdings', async () => ({ ok: true, message: 'Holding recalculation will be connected in the next milestone.' }));
  app.post('/watchlist', async () => ({ ok: true, message: 'Watchlist update worker will be connected in the next milestone.' }));
  app.post('/market', async () => ({ ok: true, message: 'Market update worker will be connected in the next milestone.' }));
  app.post('/fund-flow', async () => ({ ok: true, message: 'Fund flow update worker will be connected in the next milestone.' }));
  app.post('/news', async () => ({ ok: true, message: 'News update worker will be connected in the next milestone.' }));
  app.post('/all', async () => ({ ok: true, message: 'Full update worker will be connected in the next milestone.' }));
}
