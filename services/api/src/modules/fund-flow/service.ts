import type { FundFlowRow } from '@stock-assistant/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma';
import { toNumberOrNull } from '@stock-assistant/shared';


function toRow(record: {
  id: number;
  level: string;
  code: string | null;
  name: string | null;
  flowDate: Date;
  mainNetInflow: unknown;
  largeOrderNetInflow: unknown;
  changePercent: unknown;
}): FundFlowRow {
  return {
    id: record.id,
    level: record.level,
    code: record.code,
    name: record.name,
    flowDate: record.flowDate.toISOString().slice(0, 10),
    mainNetInflow: toNumberOrNull(record.mainNetInflow),
    largeOrderNetInflow: toNumberOrNull(record.largeOrderNetInflow),
    changePercent: toNumberOrNull(record.changePercent)
  };
}

export async function getMarketFundFlow(limit = 20) {
  const items = await prisma.fundFlow.findMany({
    where: { level: 'market' },
    orderBy: { flowDate: 'desc' },
    take: limit
  });
  return { items: items.map(toRow) };
}

async function latestRows(level: string, limit: number, filter: Prisma.FundFlowWhereInput = {}, ascending = false, metric: 'mainNetInflow' | 'changePercent' = 'mainNetInflow') {
  const latest = await prisma.fundFlow.findFirst({ where: { level }, orderBy: { flowDate: 'desc' } });
  if (!latest) return { items: [] };
  const items = await prisma.fundFlow.findMany({
    where: { ...filter, level, flowDate: latest.flowDate },
    orderBy: [{ [metric]: ascending ? 'asc' : 'desc' }, { id: 'asc' }],
    take: limit
  });
  return { items: items.map(toRow) };
}

export async function getSectorFundFlow(limit = 20, metric: 'mainNetInflow' | 'changePercent' = 'mainNetInflow') {
  return latestRows('sector', limit, {}, false, metric);
}

export async function getStockFundFlow(code: string, limit = 30) {
  const items = await prisma.fundFlow.findMany({
    where: { code, level: 'stock' },
    orderBy: { flowDate: 'desc' },
    take: limit
  });
  return { items: items.map(toRow) };
}

export async function getPortfolioFundFlow(limit = 20) {
  const holdings = await prisma.holding.findMany({ select: { code: true } });
  const codes = Array.from(new Set(holdings.map((h) => h.code)));
  if (codes.length === 0) return { items: [] };
  return latestRows('stock', limit, { code: { in: codes } });
}

export async function getWatchlistFundFlow(limit = 20) {
  const watchlist = await prisma.watchlistItem.findMany({ select: { code: true } });
  const codes = Array.from(new Set(watchlist.map((w) => w.code)));
  if (codes.length === 0) return { items: [] };
  return latestRows('stock', limit, { code: { in: codes } });
}

export async function getFundFlowByLevel(level: string, limit = 10) {
  const inflow = level === 'stock_inflow';
  return latestRows('stock', limit, { mainNetInflow: inflow ? { gt: 0 } : { lt: 0 } }, !inflow);
}
