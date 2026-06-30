import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { portfolioRoutes } from './routes/portfolio';
import { holdingsRoutes } from './routes/holdings';
import { watchlistRoutes } from './routes/watchlist';
import { stocksRoutes } from './routes/stocks';
import { marketRoutes } from './routes/market';
import { fundFlowRoutes } from './routes/fundFlow';
import { newsRoutes } from './routes/news';
import { aiRoutes } from './routes/ai';
import { settingsRoutes } from './routes/settings';
import { updateRoutes } from './routes/update';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: resolve(rootDir, '.env') });

const app = Fastify({ logger: true });
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '0.0.0.0';

await app.register(cors, { origin: true });

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

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
