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
  sortOrder: number;
  note: string | null;
  signalTags: string[];
}

export interface StockQuoteView {
  id: number;
  code: string;
  tradeDate: string;
  currentPrice: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  preClose: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  volume: number | null;
  turnover: number | null;
  turnoverRate: number | null;
}

export interface StockAnalysisSignal {
  key: string;
  label: string;
  tone: 'bull' | 'bear' | 'neutral';
  detail: string;
}

export interface StockAnalysisSummary {
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  lastClose: number;
}

export interface NewsItemView {
  id: number;
  type: string;
  title: string;
  source: string | null;
  publishDate: string;
  url: string | null;
  summary: string | null;
  sentiment: string;
  impactOnHolding: boolean;
}
