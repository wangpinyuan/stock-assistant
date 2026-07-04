import { prisma } from '../plugins/prisma';
import { toFundFlowRow, FundFlowRow } from '../utils/transform';

export type { FundFlowRow } from '../utils/transform';

export async function getMarketFundFlow(limit = 20) {
  const items = await prisma.fundFlow.findMany({
    where: { level: 'market' },
    orderBy: { flowDate: 'desc' },
    take: limit
  });
  return { items: items.map(toFundFlowRow) };
}

export async function getSectorFundFlow(limit = 20) {
  // Get concept board (theme sector) fund flow directly from FundFlow table
  const items = await prisma.fundFlow.findMany({
    where: { level: 'sector' },
    orderBy: { mainNetInflow: 'desc' },
    take: limit
  });
  return { items: items.map(toFundFlowRow) };
}

export async function getStockFundFlow(code: string, limit = 30) {
  const items = await prisma.fundFlow.findMany({
    where: { code, level: 'stock' },
    orderBy: { flowDate: 'desc' },
    take: limit
  });
  return { items: items.map(toFundFlowRow) };
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
  return { items: items.map(toFundFlowRow) };
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
  return { items: items.map(toFundFlowRow) };
}

export async function getFundFlowByLevel(level: string, limit = 10) {
  const items = await prisma.fundFlow.findMany({
    where: { level },
    orderBy: { flowDate: 'desc' },
    take: limit
  });
  return { items: items.map(toFundFlowRow) };
}
