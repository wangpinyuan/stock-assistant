import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot } from '../src/infrastructure/config';

test('breadth covers stored stocks and respects board-specific price limits', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'breadth-'));
  process.env.DATABASE_URL = `file:${resolve(directory, 'test.db')}`;
  const { prisma } = await import('../src/infrastructure/prisma');
  try {
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    const examples = [
      { code: '000001', name: '普通股', price: 11, pct: 10 },
      { code: '600000', name: 'ST示例', price: 10.5, pct: 5 },
      { code: '688001', name: '科创板', price: 11.99, pct: 19.9 },
      { code: '920001', name: '北交所', price: 12, pct: 20 },
      { code: '513130', name: 'ETF', price: 11, pct: 10 }
    ];
    for (const item of examples) {
      await prisma.stock.create({ data: { code: item.code, name: item.name, assetType: item.name === 'ETF' ? 'etf' : 'stock' } });
      await prisma.quote.create({ data: { code: item.code, tradeDate: new Date('2026-11-13'), currentPrice: item.price, preClose: 10, changePercent: item.pct } });
    }
    const { getMarketBreadth } = await import('../src/modules/market/service');
    const result = await getMarketBreadth();
    assert.equal(result.totalCount, 4);
    assert.equal(result.upCount, 4);
    assert.equal(result.limitUpCount, 2);
    assert.equal(result.tradeDate, '2026-11-13');
    assert.equal(result.scope, '库内股票行情');
  } finally {
    await prisma.$disconnect();
    delete process.env.DATABASE_URL;
    await rm(directory, { recursive: true, force: true });
  }
});
