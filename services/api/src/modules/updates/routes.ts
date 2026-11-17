import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { runWorker, type WorkerOptions, type WorkerResult } from '../../infrastructure/workerRunner';

const codesBodySchema = z.object({
  codes: z.array(z.string().regex(/^\d{6}$/, '股票代码须为六位数字')).min(1).optional(),
  source: z.enum(['akshare', 'tushare', 'sina']).optional()
}).strict();

type UpdateKind = 'quotes' | 'market' | 'kline' | 'fund-flow' | 'news';
type UpdateInput = z.infer<typeof codesBodySchema>;
interface UpdateOptions extends FastifyPluginOptions {
  runner?: (options: WorkerOptions) => Promise<WorkerResult>;
}

function workerOptions(kind: UpdateKind, input: UpdateInput): WorkerOptions {
  const args: string[] = [];
  if (kind === 'quotes' || kind === 'market' || kind === 'kline') {
    if (input.codes) args.push('--codes', [...new Set(input.codes)].join(','));
  }
  if (kind === 'quotes' || kind === 'market') {
    if (input.source) args.push('--source', input.source);
    if (kind === 'market') args.push('--market');
  }
  return {
    script: `update_${kind === 'market' ? 'quotes' : kind.replace('-', '_')}.py`,
    args,
    timeoutMs: kind === 'kline' ? 300_000 : 120_000
  };
}

export async function updateRoutes(app: FastifyInstance, options: UpdateOptions) {
  const runner = options.runner ?? runWorker;
  const kinds: UpdateKind[] = ['quotes', 'market', 'kline', 'fund-flow', 'news'];
  for (const kind of kinds) {
    app.post(`/${kind}`, async (request, reply) => {
      const input = codesBodySchema.safeParse(request.body ?? {});
      if (!input.success) return reply.code(400).send({ error: input.error.issues[0].message });
      const result = await runner(workerOptions(kind, input.data));
      return reply.code(result.ok ? 200 : 502).send(result);
    });
  }
  for (const path of ['holdings', 'watchlist']) {
    app.post(`/${path}`, async (request, reply) => {
      const input = codesBodySchema.safeParse(request.body ?? {});
      if (!input.success) return reply.code(400).send({ error: input.error.issues[0].message });
      const result = await runner(workerOptions('quotes', input.data));
      return reply.code(result.ok ? 200 : 502).send(result);
    });
  }
  app.post('/all', async (request, reply) => {
    const input = codesBodySchema.safeParse(request.body ?? {});
    if (!input.success) return reply.code(400).send({ error: input.error.issues[0].message });
    const steps: Record<string, WorkerResult> = {};
    for (const kind of ['quotes', 'kline', 'fund-flow', 'news'] as const) {
      steps[kind === 'fund-flow' ? 'fundFlow' : kind] = await runner(workerOptions(kind, input.data));
    }
    const ok = Object.values(steps).every(step => step.ok);
    return reply.code(ok ? 200 : 502).send({ ok, steps });
  });
}
