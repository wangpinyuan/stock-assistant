import { prisma } from '../plugins/prisma';

function toNumberOrNull(value: unknown) {
  return value == null ? null : Number(value);
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
        signalTags
      };
    })
  };
}
