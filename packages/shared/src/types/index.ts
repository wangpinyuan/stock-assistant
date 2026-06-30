export type AssetType = 'stock' | 'etf';

export interface PortfolioSummary {
  totalMarketValue: number;
  todayProfit: number;
  todayProfitRate: number;
  totalProfit: number;
  totalProfitRate: number;
  holdingCount: number;
  stockCount: number;
  etfCount: number;
  updatedAt: string | null;
}

export interface HoldingView {
  id: number;
  code: string;
  name: string;
  assetType: AssetType;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  changeAmount: number;
  changePercent: number;
  marketValue: number;
  weight: number;
  todayProfit: number;
  todayProfitRate: number;
  totalProfit: number;
  totalProfitRate: number;
  tags: string | null;
  note: string | null;
}

export interface WatchlistView {
  id: number;
  code: string;
  name: string;
  currentPrice: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  turnover: number | null;
  turnoverRate: number | null;
  signalTags: string[];
}
