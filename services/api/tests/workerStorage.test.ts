import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { projectRoot, resolveInterpreter } from '../src/infrastructure/config';

test('Prisma reads actual Python quote and daily/weekly/monthly writes', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'stock-storage-'));
  const url = `file:${resolve(directory, 'test.db')}`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    const result = spawnSync(resolveInterpreter(), ['-B', '-c', `
import sys
sys.path.insert(0, 'services/worker')
sys.path.insert(0, 'services/worker/scripts')
from worker import common
import update_kline
with common.connect() as conn:
    common.upsert_quote(conn, dict(code='000001', tradeDate='20261113', currentPrice=10))
    payload=dict(code='000001', open=9, high=11, low=8, close=10, volume=100)
    for fn, field in [(update_kline.upsert_daily, 'tradeDate'), (update_kline.upsert_weekly, 'weekDate'), (update_kline.upsert_monthly, 'monthDate')]:
        fn(conn, dict(payload, **{field: '20261113'}))
`], { cwd: projectRoot, env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const [quote, daily, weekly, monthly] = await Promise.all([
      prisma.quote.findFirstOrThrow(), prisma.klineDaily.findFirstOrThrow(),
      prisma.klineWeekly.findFirstOrThrow(), prisma.klineMonthly.findFirstOrThrow()
    ]);
    for (const date of [quote.tradeDate, daily.tradeDate, weekly.weekDate, monthly.monthDate]) {
      assert.equal(date.toISOString(), '2026-11-13T00:00:00.000Z');
    }
    for (const row of [daily, weekly, monthly]) assert.equal(Number(row.close), 10);
    assert.equal(Number(quote.currentPrice), 10);
  } finally {
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
