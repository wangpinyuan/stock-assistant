import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { projectRoot } from '../src/infrastructure/config';

test('legacy local news dates migrate before sorting with newly fetched news', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'news-migration-'));
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${directory}/test.db` } } });
  try {
    for (const folder of ['20260630151412_init']) {
      const sql = await readFile(resolve(projectRoot, 'prisma/migrations', folder, 'migration.sql'), 'utf8');
      for (const statement of sql.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    }
    const old = await prisma.newsItem.create({ data: { type: '资讯', title: 'Old news', publishDate: new Date('2026-11-13'), url: 'https://example.com/old' } });
    await prisma.$executeRaw`UPDATE NewsItem SET publishDate = ${'2026-11-13 08:00:00'} WHERE id = ${old.id}`;
    await prisma.newsItem.create({ data: { type: '资讯', title: 'Fresh news', publishDate: new Date('2026-11-17') } });
    const migration = await readFile(resolve(projectRoot, 'prisma/migrations/20261117030000_normalize_news_dates/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    const rows = await prisma.newsItem.findMany({ orderBy: { publishDate: 'desc' } });
    assert.equal(rows[0].title, 'Fresh news');
    assert.equal(rows[1].publishDate.toISOString(), '2026-11-13T00:00:00.000Z');
    assert.equal(rows[1].url, 'https://example.com/old');
  } finally {
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
