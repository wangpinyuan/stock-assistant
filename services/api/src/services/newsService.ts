import { prisma } from '../plugins/prisma';

function toNumberOrNull(value: unknown) {
  return value == null ? null : Number(value);
}

export interface NewsRow {
  id: number;
  type: string;
  code: string | null;
  title: string;
  source: string | null;
  publishDate: string;
  url: string | null;
  summary: string | null;
  sentiment: string;
  impactOnHolding: boolean;
}

function toRow(record: {
  id: number;
  type: string;
  code: string | null;
  title: string;
  source: string | null;
  publishDate: Date;
  url: string | null;
  summary: string | null;
  sentiment: string;
  impactOnHolding: boolean;
}): NewsRow {
  return {
    id: record.id,
    type: record.type,
    code: record.code,
    title: record.title,
    source: record.source,
    publishDate: record.publishDate.toISOString(),
    url: record.url,
    summary: record.summary,
    sentiment: record.sentiment,
    impactOnHolding: record.impactOnHolding
  };
}

export async function listNews(filter: { type?: string; limit?: number } = {}) {
  const items = await prisma.newsItem.findMany({
    where: filter.type ? { type: filter.type } : undefined,
    orderBy: { publishDate: 'desc' },
    take: filter.limit ?? 100
  });
  return { items: items.map(toRow) };
}

export async function getHoldingsImpactNews(limit = 50) {
  const holdings = await prisma.holding.findMany({ select: { code: true } });
  const codes = Array.from(new Set(holdings.map((h) => h.code)));
  if (codes.length === 0) return { items: [] };
  const items = await prisma.newsItem.findMany({
    where: { code: { in: codes }, impactOnHolding: true },
    orderBy: { publishDate: 'desc' },
    take: limit
  });
  return { items: items.map(toRow) };
}

export async function getStockNews(code: string, limit = 50) {
  const items = await prisma.newsItem.findMany({
    where: { code },
    orderBy: { publishDate: 'desc' },
    take: limit
  });
  return { items: items.map(toRow) };
}

export async function getNewsTypes() {
  const rows = await prisma.newsItem.findMany({ distinct: ['type'], select: { type: true } });
  return { items: rows.map((row) => row.type) };
}
