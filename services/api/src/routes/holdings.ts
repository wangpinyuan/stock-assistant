import type { FastifyInstance } from 'fastify';
import { getHoldings } from '../services/holdingService';

export async function holdingsRoutes(app: FastifyInstance) {
  app.get('/', async () => getHoldings());

  app.post('/', async () => ({ ok: true, message: 'Holding creation will be implemented in the next milestone.' }));

  app.put('/:id', async () => ({ ok: true, message: 'Holding update will be implemented in the next milestone.' }));

  app.delete('/:id', async () => ({ ok: true, message: 'Holding deletion will be implemented in the next milestone.' }));
}
