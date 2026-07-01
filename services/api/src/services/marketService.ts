import { prisma } from '../plugins/prisma';

function toNumberOrNull(value: unknown) {
  return value == null ? null : Number(value);
}

export interface MarketBreadth {
  tradeDate: string | null;
  upCount: number;
  downCount: number;
  flatCount: number;
  limitUpCount: number;
  limitDownCount: number;
  totalCount: number;
}

export async function getMarketBreadth(): Promise<MarketBreadth> {
  const latest = await prisma.quote.findFirst({ orderBy: { tradeDate: 'desc' } });
  if (!latest) {
    return { tradeDate: null, upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0, totalCount: 0 };
  }

  const quotes = await prisma.quote.findMany({ where: { tradeDate: latest.tradeDate } });
  let up = 0;
  let down = 0;
  let flat = 0;
  let limitUp = 0;
  let limitDown = 0;

  for (const quote of quotes) {
    const pct = toNumberOrNull(quote.changePercent);
    if (pct == null) {
      flat += 1;
      continue;
    }
    if (pct > 0) up += 1;
    else if (pct < 0) down += 1;
    else flat += 1;

    if (pct >= 9.9) limitUp += 1;
    else if (pct <= -9.9) limitDown += 1;
  }

  return {
    tradeDate: latest.tradeDate.toISOString().slice(0, 10),
    upCount: up,
    downCount: down,
    flatCount: flat,
    limitUpCount: limitUp,
    limitDownCount: limitDown,
    totalCount: quotes.length
  };
}

export interface IndexQuote {
  code: string;
  name: string;
  currentPrice: number | null;
  changeAmount: number | null;
  changePercent: number | null;
}

const MAJOR_INDEX_CODES = [
  { code: '000300', name: '沪深300' },
  { code: '000905', name: '中证500' },
  { code: '000852', name: '中证1000' },
  { code: '000016', name: '上证50' },
  { code: '399006', name: '创业板指' },
  { code: '399905', name: '中证500' }
];

export async function getMarketIndexes(): Promise<{ items: IndexQuote[] }> {
  const codes = MAJOR_INDEX_CODES.map((entry) => entry.code);
  const latest = await prisma.quote.findFirst({ orderBy: { tradeDate: 'desc' } });
  const records = await prisma.quote.findMany({
    where: { code: { in: codes }, ...(latest ? { tradeDate: latest.tradeDate } : {}) }
  });
  const byCode = new Map(records.map((r) => [r.code, r]));

  return {
    items: MAJOR_INDEX_CODES.map((entry) => {
      const quote = byCode.get(entry.code);
      return {
        code: entry.code,
        name: entry.name,
        currentPrice: toNumberOrNull(quote?.currentPrice),
        changeAmount: toNumberOrNull(quote?.changeAmount),
        changePercent: toNumberOrNull(quote?.changePercent)
      };
    })
  };
}

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
  const codes = stocks.map((stock) => stock.code);
  const quotes = await prisma.quote.findMany({
    where: { code: { in: codes }, ...(latest ? { tradeDate: latest.tradeDate } : {}) }
  });
  const quoteByCode = new Map(quotes.map((quote) => [quote.code, quote]));

  const items: SectorFlow[] = [];
  for (const [sector, members] of groups) {
    let sumPercent = 0;
    let count = 0;
    for (const stock of members) {
      const quote = quoteByCode.get(stock.code);
      const pct = toNumberOrNull(quote?.changePercent);
      if (pct != null) {
        sumPercent += pct;
        count += 1;
      }
    }
    items.push({
      name: sector,
      changePercent: count > 0 ? sumPercent / count : null,
      mainNetInflow: null,
      stockCount: members.length
    });
  }

  items.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  return { items };
}

export async function getMarketOverview() {
  const [breadth, indexes, sectors] = await Promise.all([
    getMarketBreadth(),
    getMarketIndexes(),
    getMarketSectors()
  ]);
  return { sentiment: breadth.upCount > breadth.downCount ? 'bull' : breadth.upCount < breadth.downCount ? 'bear' : 'neutral', indexes: indexes.items, sectors: sectors.items, breadth };
}
