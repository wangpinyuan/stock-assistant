import { buildApp } from './app';
import { apiHost, apiPort } from './infrastructure/config';
import { prisma } from './infrastructure/prisma';

const app = await buildApp({ logger: true });
app.addHook('onClose', async () => prisma.$disconnect());
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
try {
  await app.listen({ port: apiPort, host: apiHost });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
