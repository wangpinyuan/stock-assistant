import { bulkSchema, deleteSchema, testSchema, claudeTestSchema } from './schema';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  bulkUpsertSettings,
  renameSetting,
  deleteSetting,
  getPublicSetting,
  getConfiguredValue,
  listSettings,
  testClaudeConnection,
  testTushareConnection
} from './service';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', async () => listSettings());

  app.put('/', async (request) => {
    const body = bulkSchema.parse(request.body);
    return bulkUpsertSettings(body.items);
  });

  app.post('/rename', async request => {
    const input = z.object({ from: z.string().trim().min(1).max(100), to: z.string().trim().min(1).max(100), value: z.string().max(10_000) }).parse(request.body);
    return renameSetting(input.from, input.to, input.value);
  });

  app.delete('/', async (request, reply) => {
    const { key } = deleteSchema.parse(request.query as Record<string, string>);
    const result = await deleteSetting(key);
    if (!result) {
      reply.code(404);
      return { error: '设置项不存在' };
    }
    return { ok: true, ...result };
  });

  app.post('/test-tushare', async (request) => {
    const { token } = testSchema.parse(request.body ?? {});
    const result = await testTushareConnection(token || await getConfiguredValue('tushare.token', 'TUSHARE_TOKEN'));
    return result;
  });

  app.post('/test-claude', async (request) => {
    const body = claudeTestSchema.parse(request.body ?? {});
    return testClaudeConnection(body.apiKey || await getConfiguredValue('claude.apiKey', 'ANTHROPIC_API_KEY'), body.model || await getConfiguredValue('claude.defaultModel', 'CLAUDE_DEFAULT_MODEL'));
  });

  // Public metadata only; workers use the internal configuration service.
  app.get('/value/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const item = await getPublicSetting(key);
    if (item == null) {
      reply.code(404);
      return { error: '设置项不存在' };
    }
    return item;
  });
}
