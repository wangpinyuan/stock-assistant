import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  bulkUpsertSettings,
  deleteSetting,
  getSettingValue,
  listSettings,
  testClaudeConnection,
  testTushareConnection
} from '../services/settingService';

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        value: z.string().max(10_000)
      })
    )
    .min(1)
});

const deleteSchema = z.object({ key: z.string().min(1).max(100) });

const testSchema = z.object({ token: z.string().min(1) });
const claudeTestSchema = z.object({ apiKey: z.string().min(1), model: z.string().min(1) });

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', async () => listSettings());

  app.put('/', async (request) => {
    const body = bulkSchema.parse(request.body);
    return bulkUpsertSettings(body.items);
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
    const result = await testTushareConnection(token);
    return result;
  });

  app.post('/test-claude', async (request) => {
    const body = claudeTestSchema.parse(request.body ?? {});
    return testClaudeConnection(body.apiKey, body.model);
  });

  // Convenience endpoint to read a single value (used by the worker runner to fetch Tushare token at execution time).
  app.get('/value/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const value = await getSettingValue(key);
    if (value == null) {
      reply.code(404);
      return { error: '设置项不存在' };
    }
    return { key, value };
  });
}
