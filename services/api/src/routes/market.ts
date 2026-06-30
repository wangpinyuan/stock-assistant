import type { FastifyInstance } from 'fastify';

export async function marketRoutes(app: FastifyInstance) {
  app.get('/indexes', async () => ({ items: [] }));
  app.get('/breadth', async () => ({ upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0 }));
  app.get('/sectors', async () => ({ items: [] }));
  app.get('/overview', async () => ({ sentiment: 'neutral', indexes: [], sectors: [] }));
}
