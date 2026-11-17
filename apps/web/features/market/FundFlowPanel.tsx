'use client';
import { useState } from 'react';
import { Alert, Card, Empty, Skeleton, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ProfitText } from '../../components/ProfitText';
import { formatLargeNumber } from '@stock-assistant/shared';
import type { FundFlowRow } from '@stock-assistant/shared';
import { useApiData } from '../../hooks/useApiData';
import { useDataUpdate } from './useDataUpdate';

type NameClick = (code: string, name: string) => void;
type FundFlowTab = 'inflows' | 'outflows' | 'sectors';

const FUND_FLOW_TAB_TO_PATH: Record<FundFlowTab, string> = {
  inflows: '/fund-flow/inflows',
  outflows: '/fund-flow/outflows',
  sectors: '/fund-flow/sectors'
};

const FUND_FLOW_TAB_LABEL: Record<FundFlowTab, string> = {
  inflows: '流入前10',
  outflows: '流出前10',
  sectors: '板块'
};

const fundFlowColumns = (onNameClick: (code: string, name: string) => void): ColumnsType<FundFlowRow> => [
  { title: '名称', dataIndex: 'name', render: (v: string | null, row) => v ? <a onClick={() => row.code && onNameClick(row.code, v)}>{v}</a> : '-' },
  { title: '代码', dataIndex: 'code', width: 90 },
  { title: '日期', dataIndex: 'flowDate', width: 100 },
  { title: '主力净流入（元）', dataIndex: 'mainNetInflow', align: 'right', render: (v: number | null) => {
    if (v == null) return '-';
    const formatted = formatLargeNumber(Math.abs(v));
    return <span style={{ color: v > 0 ? '#cf1322' : '#389e0d' }}>{v > 0 ? '+' : v < 0 ? '-' : ''}{formatted}</span>;
  }},
  { title: '大单净流入', dataIndex: 'largeOrderNetInflow', align: 'right', render: (v: number | null) => {
    if (v == null) return '-';
    return <span className={v >= 0 ? 'positive' : 'negative'}>{v > 0 ? '+' : v < 0 ? '-' : ''}{formatLargeNumber(v)}元</span>;
  }},
  { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) }
];

export function FundFlowPanel({ onNameClick, refreshVersion = 0 }: { onNameClick: NameClick; refreshVersion?: number }) {
  const [fundFlowTab, setFundFlowTab] = useState<FundFlowTab>('inflows');
  const resource = useApiData<{ items: FundFlowRow[] }>(FUND_FLOW_TAB_TO_PATH[fundFlowTab], refreshVersion);
  const mutation = useDataUpdate('fund-flow', resource.reload, resource.data != null && resource.data.items.length === 0, refreshVersion);
  const error = resource.error ?? mutation.error;
  return (
    <Card title="资金流">
      <Tabs
        size="small"
        activeKey={fundFlowTab}
        onChange={(key) => { mutation.clearError(); setFundFlowTab(key as FundFlowTab); }}
        items={(['inflows', 'outflows', 'sectors'] as FundFlowTab[]).map((key) => ({
          key,
          label: FUND_FLOW_TAB_LABEL[key]
        }))}
      />
      {resource.loading || mutation.updating ? (
        <Skeleton active />
      ) : error ? (
        <Alert type="error" message="资金流数据加载失败" description={error} />
      ) : (resource.data?.items ?? []).length === 0 ? (
        <Empty description="暂无资金流数据" />
      ) : (
        <Table rowKey="id" dataSource={(resource.data?.items ?? [])} pagination={{ pageSize: 10 }} size="small" columns={fundFlowColumns(onNameClick)} />
      )}
    </Card>
  );
}
