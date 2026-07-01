'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, message, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchApi, postApi } from '../../lib/api';

interface NewsRow {
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
}

type TabKey = 'all' | 'holdings';

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'red',
  negative: 'green',
  neutral: 'default'
};

const columns: ColumnsType<NewsRow> = [
  {
    title: '标题',
    dataIndex: 'title',
    render: (value: string, row) => (
      <Space>
        {row.url ? (
          <a href={row.url} target="_blank" rel="noreferrer">{value}</a>
        ) : (
          value
        )}
        {row.impactOnHolding && <Tag color="gold">持仓影响</Tag>}
      </Space>
    )
  },
  { title: '类型', dataIndex: 'type', width: 100 },
  { title: '代码', dataIndex: 'code', width: 100, render: (v: string | null) => v ?? '-' },
  {
    title: '情绪',
    dataIndex: 'sentiment',
    width: 100,
    render: (v: string) => <Tag color={SENTIMENT_COLOR[v] ?? 'default'}>{v}</Tag>
  },
  { title: '来源', dataIndex: 'source', width: 120, render: (v: string | null) => v ?? '-' },
  { title: '发布时间', dataIndex: 'publishDate', width: 160, render: (v: string) => new Date(v).toLocaleString() }
];

export default function NewsPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [data, setData] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const path = tab === 'all' ? '/news' : '/news/holdings-impact';
    fetchApi<{ items: NewsRow[] }>(path)
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
      const result = await postApi<{ ok: boolean; error?: string }>('/update/news', {});
      if (result.ok) {
        message.success('资讯更新已提交');
      } else {
        message.warning(result.error ?? '资讯更新功能尚未接入');
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
        <Typography.Title level={2} style={{ margin: 0 }}>资讯</Typography.Title>
        <Button loading={updating} onClick={triggerUpdate}>立即更新</Button>
      </div>

      <Card>
        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key as TabKey)}
          items={[
            { key: 'all', label: '全部资讯' },
            { key: 'holdings', label: '持仓影响' }
          ]}
        />
        {loading ? (
          <Skeleton active />
        ) : error ? (
          <Alert type="error" message="资讯加载失败" description={error} />
        ) : data.length === 0 ? (
          <Empty description="暂无资讯，运行资讯 worker 后将自动填充" />
        ) : (
          <Table rowKey="id" dataSource={data} pagination={{ pageSize: 20 }} columns={columns} />
        )}
      </Card>
    </Space>
  );
}
