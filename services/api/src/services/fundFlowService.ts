import { prisma } from '../plugins/prisma';

function toNumberOrNull(value: unknown) {
  return value == null ? null : Number(value);
}

export interface FundFlowRow {
  id: number;
  level: string;
  code: string | null;
  name: string | null;
  flowDate: string;
  mainNetInflow: number | null;
  largeOrderNetInflow: number | null;
  changePercent: number | null;
}

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

export async function getSectorFundFlow(limit = 20) {
  const items = await prisma.fundFlow.findMany({
    where: { level: 'sector' },
    orderBy: { flowDate: 'desc' },
    take: limit
  });
  return { items: items.map(toRow) };
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
  const items = await prisma.fundFlow.findMany({
    where: { code: { in: codes }, level: 'stock' },
    orderBy: { flowDate: 'desc' },
    take: limit
  });
  return { items: items.map(toRow) };
}

export async function getWatchlistFundFlow(limit = 20) {
  const watchlist = await prisma.watchlistItem.findMany({ select: { code: true } });
  const codes = Array.from(new Set(watchlist.map((w) => w.code)));
  if (codes.length === 0) return { items: [] };
  const items = await prisma.fundFlow.findMany({
    where: { code: { in: codes }, level: 'stock' },
    orderBy: { flowDate: 'desc' },
    take: limit
  });
  return { items: items.map(toRow) };
}
