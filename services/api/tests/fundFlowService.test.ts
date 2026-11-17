import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot } from '../src/infrastructure/config';

test('rankings use latest provider day and share stock data with portfolio queries', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'fund-flow-test-'));
  process.env.DATABASE_URL = `file:${resolve(directory, 'test.db')}`;
  const { prisma } = await import('../src/infrastructure/prisma');
  try {
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    await prisma.stock.create({ data: { code: '000001', name: '示例' } });
    await prisma.holding.create({ data: { code: '000001', name: '示例', assetType: 'stock', quantity: 1, averageCost: 1 } });
    await prisma.fundFlow.createMany({ data: [
      { level: 'stock', code: '000001', flowDate: new Date('2026-11-12'), mainNetInflow: 99999 },
      { level: 'stock', code: '000001', flowDate: new Date('2026-11-13'), mainNetInflow: -100 },
      { level: 'sector', name: '旧板块', flowDate: new Date('2026-11-12'), mainNetInflow: 99999 },
      { level: 'sector', name: '新板块', flowDate: new Date('2026-11-13'), mainNetInflow: 100 }
    ] });
    const service = await import('../src/modules/fund-flow/service');
    assert.equal((await service.getFundFlowByLevel('stock_inflow')).items.length, 0);
    assert.equal((await service.getFundFlowByLevel('stock_outflow')).items[0].mainNetInflow, -100);
    assert.equal((await service.getPortfolioFundFlow()).items[0].mainNetInflow, -100);
    assert.equal((await service.getSectorFundFlow()).items[0].name, '新板块');
  } finally {
    await prisma.$disconnect();
    delete process.env.DATABASE_URL;
    await rm(directory, { recursive: true, force: true });
  }
});
