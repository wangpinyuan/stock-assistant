'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, message, Skeleton, Space, Table, Tabs, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchApi, postApi } from '../../lib/api';
import { ProfitText } from '../../components/ProfitText';

interface FundFlowRow {
  id: number;
  level: string;
  code: string | null;
  name: string | null;
  flowDate: string;
  mainNetInflow: number | null;
  largeOrderNetInflow: number | null;
  changePercent: number | null;
}

type TabKey = 'market' | 'sectors' | 'portfolio' | 'watchlist';

const TAB_TO_PATH: Record<TabKey, string> = {
  market: '/fund-flow/market',
  sectors: '/fund-flow/sectors',
  portfolio: '/fund-flow/portfolio',
  watchlist: '/fund-flow/watchlist'
};

const TAB_LABEL: Record<TabKey, string> = {
  market: '市场',
  sectors: '板块',
  portfolio: '持仓',
  watchlist: '自选'
};

const columns: ColumnsType<FundFlowRow> = [
  { title: '名称', dataIndex: 'name', render: (v: string | null) => v ?? '-' },
  { title: '代码', dataIndex: 'code', width: 100, render: (v: string | null) => v ?? '-' },
  { title: '日期', dataIndex: 'flowDate', width: 120 },
  {
    title: '主力净流入',
    dataIndex: 'mainNetInflow',
    align: 'right',
    render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} prefix="¥" />)
  },
  {
    title: '大单净流入',
    dataIndex: 'largeOrderNetInflow',
    align: 'right',
    render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} prefix="¥" />)
  },
  { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) }
];

export default function FundFlowPage() {
  const [tab, setTab] = useState<TabKey>('market');
  const [data, setData] = useState<FundFlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchApi<{ items: FundFlowRow[] }>(TAB_TO_PATH[tab])
      .then((payload) => {
        if (!cancelled) setData(payload.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const triggerUpdate = async () => {
    setUpdating(true);
    try {
      const result = await postApi<{ ok: boolean; error?: string }>('/update/fund-flow', {});
      if (result.ok) {
        message.success('资金流更新已提交');
      } else {
        message.warning(result.error ?? '资金流更新功能尚未接入');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '请求失败');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>资金流</Typography.Title>
        <Button loading={updating} onClick={triggerUpdate}>立即更新</Button>
      </div>

      <Card>
        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key as TabKey)}
          items={(['market', 'sectors', 'portfolio', 'watchlist'] as TabKey[]).map((key) => ({
            key,
            label: TAB_LABEL[key]
          }))}
        />
        {loading ? (
          <Skeleton active />
        ) : error ? (
          <Alert type="error" message="资金流数据加载失败" description={error} />
        ) : data.length === 0 ? (
          <Empty description="暂无资金流数据，运行资金流 worker 后将自动填充" />
        ) : (
          <Table rowKey="id" dataSource={data} pagination={{ pageSize: 20 }} columns={columns} />
        )}
      </Card>
    </Space>
  );
}
