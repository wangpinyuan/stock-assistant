import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { portfolioRoutes } from './modules/portfolio/routes';
import { holdingsRoutes } from './modules/holdings/routes';
import { watchlistRoutes } from './modules/watchlist/routes';
import { stocksRoutes } from './modules/stocks/routes';
import { marketRoutes } from './modules/market/routes';
import { fundFlowRoutes } from './modules/fund-flow/routes';
import { newsRoutes } from './modules/news/routes';
import { aiRoutes } from './modules/ai/routes';
import { settingsRoutes } from './modules/settings/routes';
import { updateRoutes } from './modules/updates/routes';
import { serializeResponse } from './infrastructure/serialize';
import { webOrigins } from './infrastructure/config';

export async function buildApp({ logger = false } = {}) {
  const app = Fastify({ logger });
  app.addHook('preSerialization', async (_request, _reply, payload) => serializeResponse(payload));
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: error.issues[0].message });
    const code = (error as { code?: string }).code;
    if (code === 'P2025') return reply.code(404).send({ error: '记录不存在' });
    if (code === 'P2002') return reply.code(409).send({ error: '记录已存在' });
    if (code === 'P2003') return reply.code(400).send({ error: '关联记录不存在' });
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) return reply.code(error.statusCode).send({ error: error.message });
    request.log.error(error);
    return reply.code(500).send({ error: '服务处理失败' });
  });
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || webOrigins.includes(origin)) return callback(null, true);
      const error = Object.assign(new Error('请求来源未获允许'), { statusCode: 403 });
      callback(error, false);
    }
  });
  app.get('/health', async () => ({ ok: true }));
  await app.register(portfolioRoutes, { prefix: '/portfolio' });
  await app.register(holdingsRoutes, { prefix: '/holdings' });
  await app.register(watchlistRoutes, { prefix: '/watchlist' });
  await app.register(stocksRoutes, { prefix: '/stocks' });
  await app.register(marketRoutes, { prefix: '/market' });
  await app.register(fundFlowRoutes, { prefix: '/fund-flow' });
  await app.register(newsRoutes, { prefix: '/news' });
  await app.register(aiRoutes, { prefix: '/ai' });
  await app.register(settingsRoutes, { prefix: '/settings' });
  await app.register(updateRoutes, { prefix: '/update' });
  return app;
}
