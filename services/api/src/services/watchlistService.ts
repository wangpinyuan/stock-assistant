import { prisma } from '../plugins/prisma';
import { toNumberOrNull } from '@stock-assistant/shared';
import { lookupStock, ensureStockExists } from '../utils/stockLookup';

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

export async function createWatchlistItem(input: WatchlistInput) {
  const stock = await prisma.stock.findUnique({ where: { code: input.code } });
  let name: string | null | undefined = input.name?.trim();
  let assetType = (stock?.assetType as 'stock' | 'etf') ?? 'stock';
  let quoteData: { currentPrice?: number; changePercent?: number } = {};

  if (!name) {
    const looked = lookupStock(input.code);
    name = looked.name;
    assetType = looked.assetType;
    quoteData = { currentPrice: looked.currentPrice, changePercent: looked.changePercent };
  }

  name = name || input.code;

  await ensureStockExists(prisma, input.code, name, assetType);

  const existing = await prisma.watchlistItem.findUnique({ where: { code: input.code } });
  if (existing) {
    return { id: existing.id, duplicate: true };
  }

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
