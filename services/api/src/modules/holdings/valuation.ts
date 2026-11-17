import { prisma } from '../../infrastructure/prisma';
import { toNumber, toNumberOrNull } from '@stock-assistant/shared';

interface ValuationInput {
  quantity: unknown;
  averageCost: unknown;
}
interface ValuationQuote {
  currentPrice: unknown;
  preClose: unknown;
  changeAmount: unknown;
  changePercent: unknown;
}

export function calculateValuation(holding: ValuationInput, quote?: ValuationQuote) {
  const quantity = toNumber(holding.quantity);
  const averageCost = toNumber(holding.averageCost);
  const currentPrice = toNumberOrNull(quote?.currentPrice);
  const changeAmount = toNumberOrNull(quote?.changeAmount);
  const changePercent = toNumberOrNull(quote?.changePercent);
  const preClose = toNumberOrNull(quote?.preClose);
  const costAmount = averageCost * quantity;
  const marketValue = currentPrice == null ? null : currentPrice * quantity;
  const todayProfit = changeAmount == null ? null : changeAmount * quantity;
  const yesterdayValue = preClose == null ? null : preClose * quantity;
  const totalProfit = marketValue == null ? null : marketValue - costAmount;
  return {
    quantity, averageCost, currentPrice, changeAmount, changePercent,
    costAmount, marketValue, todayProfit, yesterdayValue, totalProfit,
    todayProfitRate: todayProfit != null && yesterdayValue != null && yesterdayValue > 0 ? todayProfit / yesterdayValue : null,
    totalProfitRate: totalProfit != null && costAmount > 0 ? totalProfit / costAmount : null
  };
}

export async function loadValuedHoldings() {
  const holdings = await prisma.holding.findMany({
    orderBy: { id: 'asc' },
    include: { stock: { include: { quotes: { orderBy: { tradeDate: 'desc' }, take: 1 } } } }
  });
  return holdings.map(holding => {
    const quote = holding.stock.quotes[0];
    return { holding, valuation: calculateValuation(holding, quote), tradeDate: quote?.tradeDate ?? null };
  });
}
