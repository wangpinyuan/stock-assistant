import type { FastifyInstance } from 'fastify';

export async function aiRoutes(app: FastifyInstance) {
  const unavailable = async (_request: unknown, reply: import('fastify').FastifyReply) =>
    reply.code(501).send({ ok: false, error: 'AI 分析与报告历史尚未实现' });
  app.post('/analyze/stock/:code', unavailable);
  app.post('/analyze/portfolio', unavailable);
  app.post('/analyze/market', unavailable);
  app.get('/reports', unavailable);
  app.get('/reports/:id', unavailable);
}
