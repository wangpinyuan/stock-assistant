import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot, resolveDatabaseUrl } from '../src/infrastructure/config';

test('relative and default SQLite paths resolve independently of cwd', () => {
  const original = process.cwd();
  try {
    process.chdir(tmpdir());
    const expected = `file:${resolve(projectRoot, 'data/stock.db')}`;
    assert.equal(resolveDatabaseUrl('file:../data/stock.db'), expected);
    assert.equal(resolveDatabaseUrl(''), expected);
    assert.equal(resolveDatabaseUrl('file:/tmp/absolute.db'), 'file:/tmp/absolute.db');
  } finally {
    process.chdir(original);
  }
});

test('stock lookup failure preserves requested ETF type and existing security metadata', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'stock-assistant-test-'));
  const originalDb = process.env.DATABASE_URL;
  const originalPython = process.env.WORKER_PYTHON;
  process.env.DATABASE_URL = `file:${resolve(directory, 'test.db')}`;
  process.env.WORKER_PYTHON = '/nonexistent/python';
  const { prisma } = await import('../src/infrastructure/prisma');
  try {
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(part => part.trim())) {
      await prisma.$executeRawUnsafe(statement);
    }
    const { createHolding } = await import('../src/modules/holdings/service');
    const { createWatchlistItem } = await import('../src/modules/watchlist/service');
    await createWatchlistItem({ code: '513131', name: '待分类基金' });
    const classified = await createHolding({ code: '513131', assetType: 'etf', quantity: 100, averageCost: 1 });
    assert.equal((await prisma.holding.findUniqueOrThrow({ where: { id: classified.id } })).assetType, 'etf');
    assert.equal((await prisma.stock.findUniqueOrThrow({ where: { code: '513131' } })).assetType, 'etf');
    const { buildApp } = await import('../src/app');
    const app = await buildApp();
    try {
      const response = await app.inject({ method: 'POST', url: '/holdings', payload: { code: '513131', quantity: 1, averageCost: 1 } });
      assert.equal(response.statusCode, 201);
      assert.equal((await prisma.stock.findUniqueOrThrow({ where: { code: '513131' } })).assetType, 'etf');
    } finally { await app.close(); }
    const created = await createHolding({ code: '513130', assetType: 'etf', quantity: 100, averageCost: 1 });
    const holding = await prisma.holding.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(holding.assetType, 'etf');
    await prisma.stock.update({ where: { code: '513130' }, data: { name: 'ETF 已有名称' } });
    const item = await createWatchlistItem({ code: '513130' });
    const saved = await prisma.watchlistItem.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(saved.name, 'ETF 已有名称');
    assert.equal((await prisma.stock.findUniqueOrThrow({ where: { code: '513130' } })).assetType, 'etf');
  } finally {
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
    if (originalDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDb;
    if (originalPython === undefined) delete process.env.WORKER_PYTHON;
    else process.env.WORKER_PYTHON = originalPython;
  }
});
