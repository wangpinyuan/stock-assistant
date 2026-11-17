import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import { projectRoot } from '../src/infrastructure/config';

test('secret settings stay server-side and reach Python at execution time', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'settings-'));
  process.env.DATABASE_URL = `file:${directory}/test.db`;
  const { prisma } = await import('../src/infrastructure/prisma');
  const app = Fastify();
  const fetchOriginal = globalThis.fetch;
  try {
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(s => s.trim())) await prisma.$executeRawUnsafe(statement);
    const { settingsRoutes } = await import('../src/modules/settings/routes');
    await app.register(settingsRoutes);
    const secret = 'fixture-secret-value';
    const saved = await app.inject({ method: 'PUT', url: '/', payload: { items: [{ key: 'tushare.token', value: secret }] } });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.includes(secret), false);
    const listed = await app.inject({ method: 'GET', url: '/' });
    assert.equal(listed.body.includes(secret), false);
    assert.equal(listed.json().items[0].configured, true);
    const single = await app.inject({ method: 'GET', url: '/value/tushare.token' });
    assert.equal(single.body.includes(secret), false);
    await app.inject({ method: 'PUT', url: '/', payload: { items: [{ key: 'tushare.token', value: '' }] } });
    assert.equal((await prisma.setting.findUniqueOrThrow({ where: { key: 'tushare.token' } })).value, secret);
    let token: unknown;
    globalThis.fetch = async (_url, options) => {
      token = JSON.parse(String(options?.body)).token;
      return new Response(JSON.stringify({ code: 0 }), { status: 200 });
    };
    const checked = await app.inject({ method: 'POST', url: '/test-tushare', payload: {} });
    assert.equal(checked.json().ok, true);
    assert.equal(token, secret);
    const script = resolve(directory, 'update_quotes.py');
    await writeFile(script, `import os,json\nprint(json.dumps({'ok': os.environ.get('TUSHARE_TOKEN') == '${secret}'}))\n`);
    const { runWorker } = await import('../src/infrastructure/workerRunner');
    assert.equal((await runWorker({ script })).ok, true);
  } finally {
    globalThis.fetch = fetchOriginal;
    await app.close();
    await prisma.$disconnect();
    delete process.env.DATABASE_URL;
    await rm(directory, { recursive: true, force: true });
  }
});
