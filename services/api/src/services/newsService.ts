import { prisma } from '../plugins/prisma';
import { toNewsRow, NewsRow } from '../utils/transform';

export type { NewsRow } from '../utils/transform';

export async function listNews(filter: { type?: string; limit?: number } = {}) {
  const items = await prisma.newsItem.findMany({
    where: filter.type ? { type: filter.type } : undefined,
    orderBy: { publishDate: 'desc' },
    take: filter.limit ?? 100
  });
  return { items: items.map(toNewsRow) };
}

export async function getHoldingsImpactNews(limit = 50) {
  const holdings = await prisma.holding.findMany({ select: { code: true } });
  const codes = Array.from(new Set(holdings.map((h) => h.code)));
  if (codes.length === 0) {
    // No holdings, just show news with sectors
    const items = await prisma.newsItem.findMany({
      where: { sectors: { not: null } },
      orderBy: { publishDate: 'desc' },
      take: limit
    });
    return { items: items.map(toNewsRow) };
  }
  const items = await prisma.newsItem.findMany({
    where: {
      OR: [
        { code: { in: codes }, impactOnHolding: true },
        { sectors: { not: null } }
      ]
    },
    orderBy: { publishDate: 'desc' },
    take: limit
  });
  return { items: items.map(toNewsRow) };
}

export async function getStockNews(code: string, limit = 50) {
  const items = await prisma.newsItem.findMany({
    where: { code },
    orderBy: { publishDate: 'desc' },
    take: limit
  });
  return { items: items.map(toNewsRow) };
}

export async function getNewsTypes() {
  const rows = await prisma.newsItem.findMany({ distinct: ['type'], select: { type: true } });
  return { items: rows.map((row) => row.type) };
}
