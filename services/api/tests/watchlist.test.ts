import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot } from '../src/infrastructure/config';

test('name lookup does not invent a quote trading day or OHLC', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'watchlist-lookup-'));
  const originalInterpreter = process.env.WORKER_PYTHON;
  process.env.DATABASE_URL = `file:${directory}/test.db`;
  const wrapper = resolve(directory, 'python-wrapper');
  await writeFile(wrapper, '#!/bin/sh\nprintf \'%s\\n\' \'{"ok":true,"name":"Provider name","price":10,"pct":3}\'\n', { mode: 0o755 });
  process.env.WORKER_PYTHON = wrapper;
  const { prisma } = await import('../src/infrastructure/prisma');
  try {
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    const { createWatchlistItem } = await import('../src/modules/watchlist/service');
    const result = await createWatchlistItem({ code: '000001' });
    assert.equal((await prisma.watchlistItem.findUniqueOrThrow({ where: { id: result.id } })).name, 'Provider name');
    assert.equal(await prisma.quote.count(), 0);
  } finally {
    await prisma.$disconnect();
    delete process.env.DATABASE_URL;
    if (originalInterpreter === undefined) delete process.env.WORKER_PYTHON;
    else process.env.WORKER_PYTHON = originalInterpreter;
    await rm(directory, { recursive: true, force: true });
  }
});
