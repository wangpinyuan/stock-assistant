import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { projectRoot } from '../src/infrastructure/config';

test('HTTP contracts serialize Decimal prices as numbers and dates as ISO strings', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'contracts-'));
  process.env.DATABASE_URL = `file:${directory}/test.db`;
  const { prisma } = await import('../src/infrastructure/prisma');
  const { buildApp } = await import('../src/app');
  const app = await buildApp();
  try {
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(s => s.trim())) await prisma.$executeRawUnsafe(statement);
    await prisma.stock.create({ data: { code: '000001', name: '合同测试' } });
    await prisma.quote.create({ data: { code: '000001', tradeDate: new Date('2026-11-13'), currentPrice: 10.25 } });
    const response = await app.inject({ method: 'GET', url: '/stocks/000001/quote' });
    assert.equal(response.statusCode, 200);
    assert.equal(typeof response.json().currentPrice, 'number');
    assert.equal(response.json().tradeDate, '2026-11-13T00:00:00.000Z');
    assert.equal((await app.inject({ method: 'GET', url: '/stocks/999999/quote' })).statusCode, 404);
    assert.equal((await app.inject({ method: 'GET', url: '/stocks/000001/kline?period=bad' })).statusCode, 400);
  } finally {
    await app.close();
    await prisma.$disconnect();
    delete process.env.DATABASE_URL;
    await rm(directory, { recursive: true, force: true });
  }
});
