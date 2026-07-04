export interface Breadth {
  tradeDate: string | null;
  upCount: number;
  downCount: number;
  flatCount: number;
  limitUpCount: number;
  limitDownCount: number;
  totalCount: number;
  strongCount: number;
  weakCount: number;
  avgUpCount: number;
  avgDownCount: number;
}

export interface IndexQuote {
  code: string;
  name: string;
  currentPrice: number | null;
  changeAmount: number | null;
  changePercent: number | null;
}

export interface SectorFlow {
  name: string;
  changePercent: number | null;
  mainNetInflow: number | null;
  stockCount: number;
}

export interface FundFlowRow {
  id: number;
  level: string;
  code: string | null;
  name: string | null;
  flowDate: string;
  mainNetInflow: number | null;
  largeOrderNetInflow: number | null;
  changePercent: number | null;
}

export interface KlineRow {
  tradeDate?: string;
  weekDate?: string;
  monthDate?: string;
  time?: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume?: number | string | null;
  ma5?: number | string | null;
  ma10?: number | string | null;
  ma20?: number | string | null;
}
