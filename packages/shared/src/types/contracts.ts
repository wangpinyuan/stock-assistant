import type { StockAnalysisSignal, StockAnalysisSummary } from './index';

export interface SettingEntry {
  id: number;
  key: string;
  value: string;
  configured: boolean;
  secret: boolean;
  updatedAt: string;
}

export interface HoldingInput {
  code: string;
  name?: string;
  quantity: number;
  averageCost: number;
  assetType?: 'stock' | 'etf';
  buyDate?: string | null;
  tags?: string | null;
  note?: string | null;
}

export interface WatchlistInput {
  code: string;
  name?: string;
  sortOrder?: number;
  note?: string | null;
}

export interface WatchlistUpdate {
  sortOrder?: number;
  note?: string | null;
}

export interface StockSignalResponse {
  signals: StockAnalysisSignal[];
  summary: StockAnalysisSummary | null;
}
