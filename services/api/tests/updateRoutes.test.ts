import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { updateRoutes } from '../src/modules/updates/routes';
import type { WorkerOptions, WorkerResult } from '../src/infrastructure/workerRunner';

function result(ok: boolean): WorkerResult {
  return { ok, exitCode: ok ? 0 : 1, durationMs: 1, stdout: '', stderr: '', parsed: { ok }, error: ok ? undefined : 'upstream failed' };
}

test('all runs every update and reports partial failure', async () => {
  const calls: WorkerOptions[] = [];
  const app = Fastify();
  await app.register(updateRoutes, { runner: async (options: WorkerOptions) => {
    calls.push(options);
    return result(options.script !== 'update_news.py');
  } });
  try {
    const response = await app.inject({ method: 'POST', url: '/all', payload: { codes: ['000001'], source: 'sina' } });
    assert.equal(response.statusCode, 502);
    assert.equal(response.json().ok, false);
    assert.deepEqual(calls.map(call => call.script), ['update_quotes.py', 'update_kline.py', 'update_fund_flow.py', 'update_news.py']);
    assert.equal(calls[1].args?.includes('--source'), false);
    assert.equal(response.json().steps.news.ok, false);
    assert.equal(response.json().steps.quotes.ok, true);
  } finally { await app.close(); }
});

test('invalid stock codes fail without expanding the refresh scope', async () => {
  const app = Fastify();
  try {
    await app.register(updateRoutes);
    const response = await app.inject({ method: 'POST', url: '/quotes', payload: { codes: ['bad'] } });
    assert.equal(response.statusCode, 400);
  } finally { await app.close(); }
});
