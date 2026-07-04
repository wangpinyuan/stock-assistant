import { prisma } from '../plugins/prisma';
import { toNumber } from '@stock-assistant/shared';

export async function getPortfolioSummary() {
  const holdings = await prisma.holding.findMany({
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

  const rows = holdings.map((holding) => {
    const quote = holding.stock.quotes[0];
    const quantity = toNumber(holding.quantity);
    const averageCost = toNumber(holding.averageCost);
    const currentPrice = toNumber(quote?.currentPrice);
    const preClose = toNumber(quote?.preClose);
    const changeAmount = toNumber(quote?.changeAmount);
    const marketValue = currentPrice * quantity;
    const costAmount = averageCost * quantity;
    const todayProfit = changeAmount * quantity;
    const totalProfit = marketValue - costAmount;
    const yesterdayValue = preClose * quantity;

    return {
      assetType: holding.assetType,
      marketValue,
      todayProfit,
      todayProfitRate: yesterdayValue > 0 ? todayProfit / yesterdayValue : 0,
      totalProfit,
      totalProfitRate: costAmount > 0 ? totalProfit / costAmount : 0,
      updatedAt: quote?.createdAt ?? null
    };
  });

  const totalMarketValue = rows.reduce((sum, item) => sum + item.marketValue, 0);
  const todayProfit = rows.reduce((sum, item) => sum + item.todayProfit, 0);
  const totalProfit = rows.reduce((sum, item) => sum + item.totalProfit, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + toNumber(holding.quantity) * toNumber(holding.averageCost), 0);
  const yesterdayValue = totalMarketValue - todayProfit;
  const latestUpdatedAt = rows
    .map((item) => item.updatedAt)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    totalMarketValue,
    todayProfit,
    todayProfitRate: yesterdayValue > 0 ? todayProfit / yesterdayValue : 0,
    totalProfit,
    totalProfitRate: totalCost > 0 ? totalProfit / totalCost : 0,
    holdingCount: holdings.length,
    stockCount: holdings.filter((holding) => holding.assetType === 'stock').length,
    etfCount: holdings.filter((holding) => holding.assetType === 'etf').length,
    updatedAt: latestUpdatedAt?.toISOString() ?? null
  };
}
