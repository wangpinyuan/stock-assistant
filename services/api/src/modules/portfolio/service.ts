import { loadValuedHoldings } from '../holdings/valuation';

export async function getPortfolioSummary() {
  const rows = await loadValuedHoldings();
  const missingQuoteCount = rows.filter(row => row.valuation.marketValue == null).length;
  const complete = missingQuoteCount === 0;
  const knownMarketValue = rows.reduce((sum, row) => sum + (row.valuation.marketValue ?? 0), 0);
  const totalCost = rows.reduce((sum, row) => sum + row.valuation.costAmount, 0);
  const totalMarketValue = complete ? knownMarketValue : null;
  const totalProfit = totalMarketValue == null ? null : totalMarketValue - totalCost;
  const dates = rows.map(row => row.tradeDate?.toISOString().slice(0, 10) ?? null);
  const tradeDate = dates.filter((date): date is string => date != null).sort().at(-1) ?? null;
  const datesAgree = dates.every(date => date === tradeDate);
  const todayComplete = complete && datesAgree && rows.every(row => row.valuation.todayProfit != null && row.valuation.yesterdayValue != null);
  const todayProfit = todayComplete ? rows.reduce((sum, row) => sum + (row.valuation.todayProfit ?? 0), 0) : null;
  const yesterdayValue = rows.reduce((sum, row) => sum + (row.valuation.yesterdayValue ?? 0), 0);
  return {
    totalMarketValue, knownMarketValue, totalProfit, todayProfit,
    todayProfitRate: todayProfit != null && yesterdayValue > 0 ? todayProfit / yesterdayValue : null,
    totalProfitRate: totalProfit != null && totalCost > 0 ? totalProfit / totalCost : null,
    holdingCount: rows.length,
    stockCount: rows.filter(row => row.holding.stock.assetType === 'stock').length,
    etfCount: rows.filter(row => row.holding.stock.assetType === 'etf').length,
    missingQuoteCount,
    quoteCoverage: rows.length ? (rows.length - missingQuoteCount) / rows.length : 1,
    updatedAt: tradeDate,
    mixedQuoteDates: !datesAgree
  };
}
