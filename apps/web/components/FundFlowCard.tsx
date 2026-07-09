'use client';

import { Alert, Card, Empty, Skeleton, Space, Table, Tabs, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { formatLargeNumber } from '@stock-assistant/shared';
import type { FundFlowRow } from '@stock-assistant/shared';
import { ProfitText } from './ProfitText';
import type { FundFlowTab } from '../hooks/useFundFlow';

interface Props {
  tab: FundFlowTab;
  tabs: Record<FundFlowTab, string>;
  data: FundFlowRow[];
  loading: boolean;
  error: string | null;
  lastUpdateTime: Date | null;
  refreshIntervalMinutes: number;
  onTabChange: (tab: FundFlowTab) => void;
  onNameClick: (code: string, name: string) => void;
}

const columns = (onNameClick: (code: string, name: string) => void): ColumnsType<FundFlowRow> => [
  { title: '名称', dataIndex: 'name', width: 100, render: (v: string | null, row) => {
    if (!v) return '-';
    if (row.code) return <span style={{ color: '#1677ff', cursor: 'pointer' }} onClick={() => row.code && onNameClick(row.code, v)}>{v}</span>;
    return <span>{v}</span>;
  }},
  { title: '代码', dataIndex: 'code', width: 100 },
  { title: '日期', dataIndex: 'flowDate', width: 100 },
  { title: '净流入', dataIndex: 'mainNetInflow', align: 'right', width: 100, render: (v: number | null) => {
    if (v == null) return '-';
    const formatted = formatLargeNumber(Math.abs(v));
    return <span style={{ color: v > 0 ? '#cf1322' : '#389e0d' }}>{v > 0 ? '+' : ''}{formatted}</span>;
  }},
  { title: '成交量', dataIndex: 'largeOrderNetInflow', align: 'right', width: 100, render: (v: number | null) => {
    if (v == null) return '-';
    return formatLargeNumber(Math.abs(v));
  }},
  { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', width: 100, render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) }
];

export function FundFlowCard({ tab, tabs, data, loading, error, lastUpdateTime, refreshIntervalMinutes, onTabChange, onNameClick }: Props) {
  const lastUpdateText = lastUpdateTime ? `更新时间：${lastUpdateTime.toLocaleTimeString()}` : '数据加载中...';
  return (
    <Card
      title="资金流"
      extra={<Space size="small"><Typography.Text type="secondary" style={{ fontSize: 12 }}>{lastUpdateText}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 12 }}>每{refreshIntervalMinutes}分钟自动更新</Typography.Text></Space>}
    >
      <Tabs
        size="small"
        activeKey={tab}
        onChange={(key) => onTabChange(key as FundFlowTab)}
        items={(Object.keys(tabs) as FundFlowTab[]).map((key) => ({ key, label: tabs[key as FundFlowTab] }))}
      />
      {loading ? (
        <Skeleton active />
      ) : error ? (
        <Alert type="error" message="资金流数据加载失败" description={error} />
      ) : data.length === 0 ? (
        <Empty description="暂无资金流数据" />
      ) : (
        <Table
          rowKey="id"
          dataSource={data}
          pagination={tab === 'sectors' || tab === 'sector-outflows' ? false : { pageSize: 10 }}
          size="small"
          columns={columns(onNameClick)}
        />
      )}
    </Card>
  );
}
