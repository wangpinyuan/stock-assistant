import type { Breadth as MarketBreadth, IndexQuote, SectorFlow } from '@stock-assistant/shared';
import { prisma } from '../../infrastructure/prisma';
import { toNumberOrNull } from '@stock-assistant/shared';
import { getSectorFundFlow } from '../fund-flow/service';
import { runWorker } from '../../infrastructure/workerRunner';


export async function getMarketBreadth(): Promise<MarketBreadth> {
  const latest = await prisma.quote.findFirst({ where: { stock: { assetType: 'stock' } }, orderBy: { tradeDate: 'desc' } });
  if (!latest) {
    return { tradeDate: null, scope: '库内股票行情', missingCount: 0, upCount: 0, downCount: 0, flatCount: 0, limitUpCount: 0, limitDownCount: 0, totalCount: 0, strongCount: 0, weakCount: 0, avgUpCount: 0, avgDownCount: 0 };
  }

  const quotes = await prisma.quote.findMany({ where: { tradeDate: latest.tradeDate, stock: { assetType: 'stock' } }, include: { stock: true } });
  const stockCount = await prisma.stock.count({ where: { assetType: 'stock' } });
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

    const code = quote.code;
    const rate = code.startsWith('30') || code.startsWith('68') ? 0.2
      : code.startsWith('4') || code.startsWith('8') || code.startsWith('92') ? 0.3
      : quote.stock.name.toUpperCase().includes('ST') ? 0.05 : 0.1;
    const preClose = toNumberOrNull(quote.preClose);
    const price = toNumberOrNull(quote.currentPrice);
    if (preClose && price != null) {
      if (price >= Math.round(preClose * (1 + rate) * 100) / 100) limitUp += 1;
      if (price <= Math.round(preClose * (1 - rate) * 100) / 100) limitDown += 1;
    }

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
    scope: '库内股票行情',
    missingCount: Math.max(0, stockCount - quotes.length),
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


const MAJOR_INDEX_CODES = [
  { code: 'sh000300', name: '沪深300', prefix: 'sh' },
  { code: 'sh000905', name: '中证500', prefix: 'sh' },
  { code: 'sz399006', name: '创业板指', prefix: 'sz' },
  { code: 'hkHSI', name: '恒生指数', prefix: 'hk' },
  { code: 'usixic', name: '纳斯达克', prefix: 'us' },
  { code: 'usspx', name: '标普500', prefix: 'us' }
];

async function fetchFromSina(codes: string[]): Promise<Map<string, { price: number; change: number; pct: number }>> {
  const result = new Map<string, { price: number; change: number; pct: number }>();
  try {
    const output = await runWorker({
      script: 'lookup_stock.py', args: [codes.join(','), '--batch', '--indices'], timeoutMs: 30_000
    });
    const data = output.parsed as { ok: boolean; items?: Array<{ code: string; price: number; change: number; pct: number }> } | null;
    if (output.ok && data?.ok && data.items) {
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
  const sinaData = await fetchFromSina(indexCodes);

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


export async function getMarketSectors(): Promise<{ items: SectorFlow[] }> {
  const { items } = await getSectorFundFlow(20, 'changePercent');
  return {
    items: items.map(item => ({
      name: item.name ?? '',
      changePercent: item.changePercent,
      mainNetInflow: item.mainNetInflow,
      stockCount: null,
      tradeDate: item.flowDate
    }))
  };
}

export async function getMarketOverview() {
  const [breadth, indexes, sectors] = await Promise.all([
    getMarketBreadth(),
    getMarketIndexes(),
    getMarketSectors()
  ]);
  return { sentiment: breadth.upCount > breadth.downCount ? 'bull' : breadth.upCount < breadth.downCount ? 'bear' : 'neutral', indexes: indexes.items, sectors: sectors.items, breadth };
}
