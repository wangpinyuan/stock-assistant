import { prisma } from '../plugins/prisma';
import { execSync } from 'child_process';
import { resolve } from 'path';

function toNumberOrNull(value: unknown) {
  return value == null ? null : Number(value);
}

function lookupStockFromAkShare(code: string): { name: string | null; assetType: 'stock' | 'etf'; currentPrice?: number; changePercent?: number } {
  try {
    const scriptsDir = resolve(__dirname, '..', '..', '..', '..', 'worker', 'scripts');
    const result = execSync(`python3 "${scriptsDir}/lookup_stock.py" "${code}"`, {
      timeout: 15000,
      encoding: 'utf-8'
    });
    const data = JSON.parse(result) as { ok: boolean; name?: string; currentPrice?: number; changePercent?: number; error?: string };
    if (!data.ok) return { name: null, assetType: 'stock' };
    return { name: data.name ?? null, assetType: 'stock', currentPrice: data.currentPrice, changePercent: data.changePercent };
  } catch {
    return { name: null, assetType: 'stock' };
  }
}

export async function getWatchlist() {
  const items = await prisma.watchlistItem.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: {
      stock: {
        include: {
          quotes: {
            orderBy: { tradeDate: 'desc' },
            take: 1
          }
        }
      }
    }
  });

  return {
    items: items.map((item) => {
      const quote = item.stock.quotes[0];
      const changePercent = toNumberOrNull(quote?.changePercent);
      const signalTags = changePercent == null ? [] : [changePercent >= 0 ? '上涨' : '下跌'];

      return {
        id: item.id,
        code: item.code,
        name: item.name,
        currentPrice: toNumberOrNull(quote?.currentPrice),
        changeAmount: toNumberOrNull(quote?.changeAmount),
        changePercent,
        turnover: toNumberOrNull(quote?.turnover),
        turnoverRate: toNumberOrNull(quote?.turnoverRate),
        sortOrder: item.sortOrder,
        note: item.note,
        signalTags
      };
    })
  };
}

export interface WatchlistInput {
  code: string;
  name?: string;
  sortOrder?: number;
  note?: string | null;
}

async function ensureStock(code: string, name: string, assetType: 'stock' | 'etf' = 'stock') {
  return prisma.stock.upsert({
    where: { code },
    create: { code, name, assetType, market: 'A股' },
    update: {}
  });
}

export async function createWatchlistItem(input: WatchlistInput) {
  const stock = await prisma.stock.findUnique({ where: { code: input.code } });
  let name: string | null | undefined = input.name?.trim() || stock?.name;
  let assetType = (stock?.assetType as 'stock' | 'etf') ?? 'stock';
  let quoteData: { currentPrice?: number; changePercent?: number } = {};

  if (!name) {
    const looked = lookupStockFromAkShare(input.code);
    name = looked.name;
    assetType = looked.assetType;
    quoteData = { currentPrice: looked.currentPrice, changePercent: looked.changePercent };
  }

  name = name || input.code;

  await ensureStock(input.code, name, assetType);

  const existing = await prisma.watchlistItem.findUnique({ where: { code: input.code } });
  if (existing) {
    return { id: existing.id, duplicate: true };
  }

  // Get max sortOrder and add 1
  const maxOrder = await prisma.watchlistItem.aggregate({ _max: { sortOrder: true } });
  const sortOrder = input.sortOrder ?? ((maxOrder._max.sortOrder ?? 0) + 1);

  const item = await prisma.watchlistItem.create({
    data: {
      code: input.code,
      name,
      sortOrder,
      note: input.note ?? null
    }
  });

  // Fetch and save quote data if we have it
  if (quoteData.currentPrice != null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prevClose = quoteData.changePercent != null
      ? quoteData.currentPrice / (1 + quoteData.changePercent / 100)
      : quoteData.currentPrice;
    const changeAmount = quoteData.currentPrice - prevClose;

    await prisma.quote.upsert({
      where: { code_tradeDate: { code: input.code, tradeDate: today } },
      create: {
        code: input.code,
        tradeDate: today,
        currentPrice: quoteData.currentPrice,
        open: quoteData.currentPrice,
        high: quoteData.currentPrice,
        low: quoteData.currentPrice,
        close: quoteData.currentPrice,
        preClose: prevClose,
        changeAmount,
        changePercent: quoteData.changePercent ?? 0
      },
      update: {
        currentPrice: quoteData.currentPrice,
        close: quoteData.currentPrice,
        changeAmount,
        changePercent: quoteData.changePercent ?? 0
      }
    });
  }

  return { id: item.id };
}

export interface WatchlistUpdate {
  sortOrder?: number;
  note?: string | null;
}

export async function updateWatchlistItem(id: number, input: WatchlistUpdate) {
  const existing = await prisma.watchlistItem.findUnique({ where: { id } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (input.sortOrder != null) data.sortOrder = input.sortOrder;
  if (input.note !== undefined) data.note = input.note ?? null;

  await prisma.watchlistItem.update({ where: { id }, data });
  return { id };
}

export async function deleteWatchlistItem(id: number) {
  const existing = await prisma.watchlistItem.findUnique({ where: { id } });
  if (!existing) return null;
  await prisma.watchlistItem.delete({ where: { id } });
  return { id };
}
