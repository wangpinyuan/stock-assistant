import { prisma } from '../plugins/prisma';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { toNumberOrNull } from '@stock-assistant/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MarketBreadth {
  tradeDate: string | null;
  upCount: number;
  downCount: number;
  flatCount: number;
  limitUpCount: number;
  limitDownCount: number;
  totalCount: number;
  strongCount: number;    // 强势股（涨幅 > 3%）
  weakCount: number;      // 弱势股（跌幅 > 3%）
  avgUpCount: number;     // 均价上涨（现价 > 开盘价）
  avgDownCount: number;   // 均价下跌（现价 < 开盘价）
}

export async function getMarketBreadth(): Promise<MarketBreadth> {
  const latest = await prisma.quote.findFirst({ orderBy: { tradeDate: 'desc' } });
  if (!latest) {
    return { tradeDate: null, upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0, totalCount: 0, strongCount: 0, weakCount: 0, avgUpCount: 0, avgDownCount: 0 };
  }

  const quotes = await prisma.quote.findMany({ where: { tradeDate: latest.tradeDate } });
  let up = 0;
  let down = 0;
  let flat = 0;
  let limitUp = 0;
  let limitDown = 0;
  let strong = 0;
  let weak = 0;
  let avgUp = 0;
  let avgDown = 0;

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

    // 强势股（涨幅 > 3%）和弱势股（跌幅 > 3%）
    if (pct > 3) strong += 1;
    else if (pct < -3) weak += 1;

    // 均价涨跌（现价 > 开盘价）
    const open = toNumberOrNull(quote.open);
    const current = toNumberOrNull(quote.currentPrice);
    if (open != null && current != null) {
      if (current > open) avgUp += 1;
      else if (current < open) avgDown += 1;
    }
  }

  return {
    tradeDate: latest.tradeDate.toISOString().slice(0, 10),
    upCount: up,
    downCount: down,
    flatCount: flat,
    limitUpCount: limitUp,
    limitDownCount: limitDown,
    totalCount: quotes.length,
    strongCount: strong,
    weakCount: weak,
    avgUpCount: avgUp,
    avgDownCount: avgDown
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
  { code: '000300', name: '沪深300', prefix: 'sh' },
  { code: '000905', name: '中证500', prefix: 'sh' },
  { code: '399006', name: '创业板指', prefix: 'sz' },
  { code: 'hkHSI', name: '恒生指数', prefix: 'hk' },
  { code: 'usixic', name: '纳斯达克', prefix: 'us' },
  { code: 'usspx', name: '标普500', prefix: 'us' }
];

function fetchFromSina(codes: string[]): Map<string, { price: number; change: number; pct: number }> {
  const result = new Map<string, { price: number; change: number; pct: number }>();
  try {
    const scriptsDir = resolve(__dirname, '..', '..', '..', 'worker', 'scripts');
    const joined = codes.join(',');
    const output = execSync(`python3 "${scriptsDir}/lookup_stock.py" "${joined}" --batch`, {
      timeout: 30000,
      encoding: 'utf-8'
    });
    const data = JSON.parse(output) as { ok: boolean; items?: Array<{ code: string; price: number; change: number; pct: number }> };
    if (data.ok && data.items) {
      for (const item of data.items) {
        result.set(item.code, { price: item.price, change: item.change, pct: item.pct });
      }
    }
  } catch (err) {
    console.error('[ERROR] fetchFromSina failed:', err);
  }
  return result;
}

export async function getMarketIndexes(): Promise<{ items: IndexQuote[] }> {
  // Try to get from Sina API first for real-time data
  const indexCodes = MAJOR_INDEX_CODES.map((entry) => entry.code);
  const sinaData = fetchFromSina(indexCodes);

  // Merge with database data
  const latest = await prisma.quote.findFirst({ orderBy: { tradeDate: 'desc' } });
  const records = latest
    ? await prisma.quote.findMany({ where: { code: { in: indexCodes }, tradeDate: latest.tradeDate } })
    : [];
  const dbByCode = new Map(records.map((r) => [r.code, r]));

  return {
    items: MAJOR_INDEX_CODES.map((entry) => {
      const sina = sinaData.get(entry.code);
      const db = dbByCode.get(entry.code);
      // Prefer Sina data if available, otherwise use database
      if (sina) {
        return {
          code: entry.code,
          name: entry.name,
          currentPrice: sina.price,
          changeAmount: sina.change,
          changePercent: sina.pct
        };
      }
      return {
        code: entry.code,
        name: entry.name,
        currentPrice: toNumberOrNull(db?.currentPrice),
        changeAmount: toNumberOrNull(db?.changeAmount),
        changePercent: toNumberOrNull(db?.changePercent)
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
  const quotes = latest
    ? await prisma.quote.findMany({ where: { code: { in: codes }, tradeDate: latest.tradeDate } })
    : [];
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
