import { prisma } from '../plugins/prisma';

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export async function getHoldings() {
  const holdings = await prisma.holding.findMany({
    orderBy: { id: 'asc' },
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

  const rawRows = holdings.map((holding) => {
    const quote = holding.stock.quotes[0];
    const quantity = toNumber(holding.quantity);
    const averageCost = toNumber(holding.averageCost);
    const currentPrice = toNumber(quote?.currentPrice);
    const changeAmount = toNumber(quote?.changeAmount);
    const changePercent = toNumber(quote?.changePercent);
    const marketValue = currentPrice * quantity;
    const costAmount = averageCost * quantity;
    const todayProfit = changeAmount * quantity;
    const totalProfit = marketValue - costAmount;
    const yesterdayValue = toNumber(quote?.preClose) * quantity;

    return {
      id: holding.id,
      code: holding.code,
      name: holding.name,
      assetType: holding.assetType,
      quantity,
      averageCost,
      currentPrice,
      changeAmount,
      changePercent,
      marketValue,
      costAmount,
      todayProfit,
      todayProfitRate: yesterdayValue > 0 ? todayProfit / yesterdayValue : 0,
      totalProfit,
      totalProfitRate: costAmount > 0 ? totalProfit / costAmount : 0,
      tags: holding.tags,
      note: holding.note
    };
  });

  const totalMarketValue = rawRows.reduce((sum, row) => sum + row.marketValue, 0);

  return {
    items: rawRows.map(({ costAmount, ...row }) => ({
      ...row,
      weight: totalMarketValue > 0 ? row.marketValue / totalMarketValue : 0
    }))
  };
}
