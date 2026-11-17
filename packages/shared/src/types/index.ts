export * from './market';
export * from './contracts';

export type AssetType = 'stock' | 'etf';

export interface PortfolioSummary {
  totalMarketValue: number | null;
  todayProfit: number | null;
  todayProfitRate: number | null;
  totalProfit: number | null;
  totalProfitRate: number | null;
  holdingCount: number;
  stockCount: number;
  etfCount: number;
  updatedAt: string | null;
  knownMarketValue: number;
  missingQuoteCount: number;
  quoteCoverage: number;
  mixedQuoteDates: boolean;
}

export interface HoldingView {
  id: number;
  code: string;
  name: string;
  assetType: AssetType;
  quantity: number;
  averageCost: number;
  currentPrice: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  marketValue: number | null;
  weight: number | null;
  todayProfit: number | null;
  todayProfitRate: number | null;
  totalProfit: number | null;
  totalProfitRate: number | null;
  buyDate: string | null;
  quoteTradeDate: string | null;
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
  code: string | null;
  type: string;
  title: string;
  source: string | null;
  publishDate: string;
  url: string | null;
  summary: string | null;
  sentiment: string;
  impactOnHolding: boolean;
}
