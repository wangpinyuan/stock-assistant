import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot } from '../src/infrastructure/config';

test('sector performance uses collected board data without requiring stock classification', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'market-sectors-'));
  process.env.DATABASE_URL = `file:${directory}/test.db`;
  const { prisma } = await import('../src/infrastructure/prisma');
  try {
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    await prisma.stock.create({ data: { code: '000001', name: '未分类证券' } });
    await prisma.fundFlow.createMany({ data: [
      { level: 'sector', name: '旧数据板块', flowDate: new Date('2026-11-12'), changePercent: 20 },
      { level: 'sector', name: '当前板块', flowDate: new Date('2026-11-13'), changePercent: 3.5, mainNetInflow: 1000 }
    ] });
    const { getMarketSectors } = await import('../src/modules/market/service');
    const result = await getMarketSectors();
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].name, '当前板块');
    assert.equal(result.items[0].changePercent, 3.5);
    assert.equal(result.items[0].mainNetInflow, 1000);
    assert.equal(result.items[0].tradeDate, '2026-11-13');
    assert.equal(result.items[0].stockCount, null);
  } finally {
    await prisma.$disconnect();
    delete process.env.DATABASE_URL;
    await rm(directory, { recursive: true, force: true });
  }
});
