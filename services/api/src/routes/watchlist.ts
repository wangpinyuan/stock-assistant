import type { FastifyInstance } from 'fastify';
import { getWatchlist } from '../services/watchlistService';

export async function watchlistRoutes(app: FastifyInstance) {
  app.get('/', async () => getWatchlist());

  app.post('/', async () => ({ ok: true, message: 'Watchlist creation will be implemented in the next milestone.' }));

  app.put('/:id', async () => ({ ok: true, message: 'Watchlist update will be implemented in the next milestone.' }));

  app.delete('/:id', async () => ({ ok: true, message: 'Watchlist deletion will be implemented in the next milestone.' }));
}
