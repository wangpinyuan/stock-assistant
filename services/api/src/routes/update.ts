import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runWorker } from '../services/workerRunner';

const codesBodySchema = z.object({
  codes: z.array(z.string()).optional(),
  source: z.enum(['akshare', 'tushare']).optional()
});

type CodesBody = z.infer<typeof codesBodySchema>;

function parseBody(body: unknown): CodesBody {
  if (body == null) return {};
  return codesBodySchema.parse(body);
}

function buildArgs(parsed: CodesBody, prefix: string[] = []): string[] {
  const args = [...prefix];
  if (parsed.codes?.length) args.push('--codes', parsed.codes.join(','));
  if (parsed.source) args.push('--source', parsed.source);
  return args;
}

async function runUpdate(script: string, body: unknown) {
  const parsed = parseBody(body);
  const args = buildArgs(parsed);
  const result = await runWorker({ script, args });
  return { ...result, script, args };
}

export async function updateRoutes(app: FastifyInstance) {
  app.post('/quotes', async (request) => runUpdate('update_quotes.py', request.body));
  app.post('/holdings', async (request) => runUpdate('update_quotes.py', request.body));
  app.post('/watchlist', async (request) => runUpdate('update_quotes.py', request.body));

  app.post('/market', async () => ({ ok: false, error: 'Market update worker is not implemented yet.' }));
  app.post('/fund-flow', async () => ({ ok: false, error: 'Fund flow update worker is not implemented yet.' }));
  app.post('/news', async () => ({ ok: false, error: 'News update worker is not implemented yet.' }));

  app.post('/all', async (request) => {
    const parsed = parseBody(request.body);
    const args = buildArgs(parsed);
    const quotes = await runWorker({ script: 'update_quotes.py', args });
    return {
      ok: quotes.ok,
      steps: {
        quotes: { ok: quotes.ok, durationMs: quotes.durationMs, parsed: quotes.parsed, error: quotes.error }
      }
    };
  });
}
