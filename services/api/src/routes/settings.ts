import type { FastifyInstance } from 'fastify';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', async () => ({ items: [] }));
  app.put('/', async () => ({ ok: true, message: 'Settings update will be implemented in the next milestone.' }));
  app.post('/test-tushare', async () => ({ ok: false, message: 'Tushare connection test is not implemented yet.' }));
  app.post('/test-claude', async () => ({ ok: false, message: 'Claude connection test is not implemented yet.' }));
}
