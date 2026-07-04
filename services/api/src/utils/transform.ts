import { toNumberOrNull } from '@stock-assistant/shared';

export interface NewsRow {
  id: number;
  type: string;
  code: string | null;
  title: string;
  source: string | null;
  publishDate: string;
  url: string | null;
  summary: string | null;
  sentiment: string;
  impactOnHolding: boolean;
  sectors: string | null;
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

export function toNewsRow(record: {
  id: number;
  type: string;
  code: string | null;
  title: string;
  source: string | null;
  publishDate: Date;
  url: string | null;
  summary: string | null;
  sentiment: string;
  impactOnHolding: boolean;
  sectors: string | null;
}): NewsRow {
  return {
    id: record.id,
    type: record.type,
    code: record.code,
    title: record.title,
    source: record.source,
    publishDate: record.publishDate.toISOString(),
    url: record.url,
    summary: record.summary,
    sentiment: record.sentiment,
    impactOnHolding: record.impactOnHolding,
    sectors: record.sectors
  };
}

export function toFundFlowRow(record: {
  id: number;
  level: string;
  code: string | null;
  name: string | null;
  flowDate: Date;
  mainNetInflow: unknown;
  largeOrderNetInflow: unknown;
  changePercent: unknown;
}): FundFlowRow {
  return {
    id: record.id,
    level: record.level,
    code: record.code,
    name: record.name,
    flowDate: record.flowDate.toISOString().slice(0, 10),
    mainNetInflow: toNumberOrNull(record.mainNetInflow),
    largeOrderNetInflow: toNumberOrNull(record.largeOrderNetInflow),
    changePercent: toNumberOrNull(record.changePercent)
  };
}
