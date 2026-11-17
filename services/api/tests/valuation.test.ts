import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot } from '../src/infrastructure/config';

test('holding and portfolio share valuation and preserve missing quotes', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'valuation-'));
  process.env.DATABASE_URL = `file:${resolve(directory, 'test.db')}`;
  const { prisma } = await import('../src/infrastructure/prisma');
  try {
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    const { getPortfolioSummary } = await import('../src/modules/portfolio/service');
    assert.equal((await getPortfolioSummary()).totalMarketValue, 0);
    await prisma.stock.createMany({ data: [{ code: '000001', name: '有行情' }, { code: '600000', name: '缺行情' }] });
    await prisma.holding.createMany({ data: [
      { code: '000001', name: '有行情', assetType: 'stock', quantity: 10, averageCost: 8 },
      { code: '600000', name: '缺行情', assetType: 'stock', quantity: 10, averageCost: 5 }
    ] });
    const { getHoldings } = await import('../src/modules/holdings/service');
    assert.equal((await getHoldings()).items[0].currentPrice, null);
    assert.equal((await getPortfolioSummary()).totalMarketValue, null);
    await prisma.quote.create({ data: { code: '000001', tradeDate: new Date('2026-11-13'), currentPrice: 10, preClose: 9, changeAmount: 1, changePercent: 11.11 } });
    const partial = await getPortfolioSummary();
    assert.equal(partial.totalMarketValue, null);
    assert.equal(partial.knownMarketValue, 100);
    assert.equal(partial.missingQuoteCount, 1);
    assert.equal(partial.quoteCoverage, 0.5);
    await prisma.quote.create({ data: { code: '600000', tradeDate: new Date('2026-11-13'), currentPrice: 6, preClose: 5, changeAmount: 1 } });
    const rows = (await getHoldings()).items;
    const summary = await getPortfolioSummary();
    assert.equal(summary.totalMarketValue, rows.reduce((sum, row) => sum + (row.marketValue ?? 0), 0));
    assert.equal(summary.totalProfit, 30);
    assert.equal(summary.todayProfit, 20);
    assert.equal(summary.todayProfitRate, 20 / 140);
    await prisma.quote.updateMany({ where: { code: '600000' }, data: { tradeDate: new Date('2026-11-12') } });
    assert.equal((await getPortfolioSummary()).todayProfit, null);
    assert.equal((await getPortfolioSummary()).mixedQuoteDates, true);
    await prisma.holding.updateMany({ data: { averageCost: 0 } });
    assert.equal((await getPortfolioSummary()).totalProfitRate, null);
  } finally {
    await prisma.$disconnect();
    delete process.env.DATABASE_URL;
    await rm(directory, { recursive: true, force: true });
  }
});
