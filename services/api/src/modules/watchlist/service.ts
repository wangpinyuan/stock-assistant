import type { WatchlistInput, WatchlistUpdate } from '@stock-assistant/shared';
import { prisma } from '../../infrastructure/prisma';
import { toNumberOrNull } from '@stock-assistant/shared';
import { lookupSecurity, ensureStock } from '../stocks/catalog';

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
        name: item.stock.name,
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


export async function createWatchlistItem(input: WatchlistInput) {
  const stock = await prisma.stock.findUnique({ where: { code: input.code } });
  let name: string | null | undefined = stock?.name && stock.name !== input.code ? stock.name : input.name?.trim();
  const assetType = (stock?.assetType as 'stock' | 'etf') ?? 'stock';

  if (!name) {
    const looked = await lookupSecurity(input.code);
    name = looked.name;
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

  return { id: item.id };
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
