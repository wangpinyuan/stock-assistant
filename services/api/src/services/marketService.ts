import { prisma } from '../plugins/prisma';
import { toNumberOrNull } from '@stock-assistant/shared';
import { lookupStockNames, lookupStockPrices } from '../utils/stockLookup';

// ==================== Magic numbers ====================
const LIMIT_UP_THRESHOLD = 9.9;
const STRONG_THRESHOLD = 3;
const WEAK_THRESHOLD = -3;

// ==================== Market Breadth ====================
export interface MarketBreadth {
  tradeDate: string | null;
  upCount: number;
  downCount: number;
  flatCount: number;
  limitUpCount: number;
  limitDownCount: number;
  totalCount: number;
  strongCount: number;
  weakCount: number;
  avgUpCount: number;
  avgDownCount: number;
}

export async function getMarketBreadth(): Promise<MarketBreadth> {
  // Find the most recent trading date with a meaningful number of quotes (avoid Sunday/holiday sparse data)
  const dateCounts = await prisma.quote.groupBy({
    by: ['tradeDate'],
    _count: { id: true },
    orderBy: { tradeDate: 'desc' },
    take: 5
  });

  const validDate = dateCounts.find((d) => d._count.id >= 100)?.tradeDate ?? dateCounts[0]?.tradeDate;
  if (!validDate) {
    return { tradeDate: null, upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0, totalCount: 0, strongCount: 0, weakCount: 0, avgUpCount: 0, avgDownCount: 0 };
  }

  const quotes = await prisma.quote.findMany({
    where: { tradeDate: validDate },
    include: { stock: true }
  }).then((qs) => qs.filter((q) => q.stock?.assetType === 'stock'));

  let up = 0, down = 0, flat = 0, limitUp = 0, limitDown = 0, strong = 0, weak = 0, avgUp = 0, avgDown = 0;

  for (const quote of quotes) {
    const pct = toNumberOrNull(quote.changePercent);
    if (pct == null) { flat += 1; continue; }
    if (pct > 0) up += 1;
    else if (pct < 0) down += 1;
    else flat += 1;

    if (pct >= LIMIT_UP_THRESHOLD) limitUp += 1;
    else if (pct <= -LIMIT_UP_THRESHOLD) limitDown += 1;

    if (pct > STRONG_THRESHOLD) strong += 1;
    else if (pct < WEAK_THRESHOLD) weak += 1;

    const open = toNumberOrNull(quote.open);
    const current = toNumberOrNull(quote.currentPrice);
    if (open != null && current != null) {
      if (current > open) avgUp += 1;
      else if (current < open) avgDown += 1;
    }
  }

  return {
    tradeDate: validDate.toISOString().slice(0, 10),
    upCount: up, downCount: down, flatCount: flat,
    limitUpCount: limitUp, limitDownCount: limitDown, totalCount: quotes.length,
    strongCount: strong, weakCount: weak, avgUpCount: avgUp, avgDownCount: avgDown
  };
}

// ==================== Index Quotes ====================
export interface IndexQuote {
  code: string;
  name: string;
  currentPrice: number | null;
  changeAmount: number | null;
  changePercent: number | null;
}

const MAJOR_INDEX_CODES = [
  { code: '000300', name: '沪深300', prefix: 'sh' },
  { code: '000905', name: '中证500', prefix: 'sh' },
  { code: '399006', name: '创业板指', prefix: 'sz' },
  { code: 'hkHSI', name: '恒生指数', prefix: 'hk' },
  { code: 'usixic', name: '纳斯达克', prefix: 'us' },
  { code: 'usspx', name: '标普500', prefix: 'us' }
];

function getLookupCode(entry: typeof MAJOR_INDEX_CODES[number]): string {
  // US/HK indices already include market prefix in code, use directly
  if (entry.prefix === 'us' || entry.prefix === 'hk') return entry.code;
  return `${entry.prefix}${entry.code}`;
}

export async function getMarketIndexes(): Promise<{ items: IndexQuote[] }> {
  const indexCodes = MAJOR_INDEX_CODES.map((e) => e.code);
  const sinaCodes = MAJOR_INDEX_CODES.map((e) => getLookupCode(e));
  const sinaPrices = lookupStockPrices(sinaCodes);

  const latest = await prisma.quote.findFirst({ orderBy: { tradeDate: 'desc' } });
  const records = latest
    ? await prisma.quote.findMany({ where: { code: { in: indexCodes }, tradeDate: latest.tradeDate } })
    : [];
  const dbByCode = new Map(records.map((r) => [r.code, r]));

  return {
    items: MAJOR_INDEX_CODES.map((entry) => {
      const db = dbByCode.get(entry.code);
      const sinaKey = getLookupCode(entry);
      const sinaData = sinaPrices.get(sinaKey);
      // Use Sina data if available, otherwise fall back to database
      return {
        code: entry.code,
        name: entry.name,
        currentPrice: sinaData ? sinaData.price : toNumberOrNull(db?.currentPrice),
        changeAmount: sinaData ? sinaData.change : toNumberOrNull(db?.changeAmount),
        changePercent: sinaData ? sinaData.pct : toNumberOrNull(db?.changePercent)
      };
    })
  };
}

// ==================== Sectors ====================
export interface SectorFlow {
  name: string;
  changePercent: number | null;
  mainNetInflow: number | null;
  stockCount: number;
}

export async function getMarketSectors(): Promise<{ items: SectorFlow[] }> {
  const stocks = await prisma.stock.findMany({ where: { sector: { not: null } } });
  const groups = new Map<string, typeof stocks>();
  for (const stock of stocks) {
    if (!stock.sector) continue;
    const list = groups.get(stock.sector) ?? [];
    list.push(stock);
    groups.set(stock.sector, list);
  }

  const latest = await prisma.quote.findFirst({ orderBy: { tradeDate: 'desc' } });
  const codes = stocks.map((s) => s.code);
  const quotes = latest
    ? await prisma.quote.findMany({ where: { code: { in: codes }, tradeDate: latest.tradeDate } })
    : [];
  const quoteByCode = new Map(quotes.map((q) => [q.code, q]));

  const items: SectorFlow[] = [];
  for (const [sector, members] of groups) {
    let sumPercent = 0, count = 0;
    for (const stock of members) {
      const quote = quoteByCode.get(stock.code);
      const pct = toNumberOrNull(quote?.changePercent);
      if (pct != null) { sumPercent += pct; count += 1; }
    }
    items.push({ name: sector, changePercent: count > 0 ? sumPercent / count : null, mainNetInflow: null, stockCount: members.length });
  }

  items.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  return { items };
}

// ==================== Breadth Stock List ====================
export interface BreadthStockItem {
  code: string;
  name: string;
  changePercent: number | null;
  currentPrice: number | null;
}

type BreadthType = 'limitUp' | 'limitDown' | 'strong' | 'weak';

export async function getBreadthStocks(type: BreadthType, limit = 50): Promise<{ items: BreadthStockItem[] }> {
  const latest = await prisma.quote.findFirst({ orderBy: { tradeDate: 'desc' } });
  if (!latest) return { items: [] };

  const where: Record<string, unknown> = { tradeDate: latest.tradeDate };
  const orderBy: Record<string, string> = type === 'limitDown' || type === 'weak' ? { changePercent: 'asc' } : { changePercent: 'desc' };

  switch (type) {
    case 'limitUp': where.changePercent = { gte: LIMIT_UP_THRESHOLD }; break;
    case 'limitDown': where.changePercent = { lte: -LIMIT_UP_THRESHOLD }; break;
    case 'strong': where.changePercent = { gt: STRONG_THRESHOLD }; break;
    case 'weak': where.changePercent = { lt: WEAK_THRESHOLD }; break;
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: { stock: true },
    orderBy,
    take: limit
  });

  const codes = quotes.map((q) => q.code);
  const namesFromSina = lookupStockNames(codes);

  return {
    items: quotes.map((q) => ({
      code: q.code,
      name: namesFromSina.get(q.code) ?? q.stock?.name ?? q.code,
      changePercent: toNumberOrNull(q.changePercent),
      currentPrice: toNumberOrNull(q.currentPrice)
    }))
  };
}

// ==================== Overview ====================
export async function getMarketOverview() {
  const [breadth, indexes] = await Promise.all([getMarketBreadth(), getMarketIndexes()]);
  const sentiment = breadth.upCount > breadth.downCount ? 'bull' : breadth.upCount < breadth.downCount ? 'bear' : 'neutral';
  return { sentiment, indexes: indexes.items, breadth };
}
