'use client';

import { useEffect, useState } from 'react';
import { Alert, Card, Spin, Table, Tag, Typography } from 'antd';
import type { WatchlistView } from '@stock-assistant/shared';
import { fetchApi } from '../lib/api';
import { ProfitText } from './ProfitText';

export function WatchlistPanel() {
  const [items, setItems] = useState<WatchlistView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<{ items: WatchlistView[] }>('/watchlist')
      .then((data) => setItems(data.items))
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : '数据加载失败');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Spin />;
  }

  if (error) {
    return <Alert type="error" message="自选数据加载失败" description={error} />;
  }

  return (
    <Card>
      <Typography.Title level={3}>自选</Typography.Title>
      <Table
        rowKey="id"
        dataSource={items}
        pagination={false}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '代码', dataIndex: 'code' },
          { title: '当前价', dataIndex: 'currentPrice', align: 'right', render: (value: number | null) => value?.toFixed(2) ?? '-' },
          { title: '涨跌额', dataIndex: 'changeAmount', align: 'right', render: (value: number | null) => value == null ? '-' : <ProfitText value={value} /> },
          { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (value: number | null) => value == null ? '-' : <ProfitText value={value} suffix="%" /> },
          { title: '信号', dataIndex: 'signalTags', render: (tags: string[]) => tags.map((tag) => <Tag key={tag}>{tag}</Tag>) }
        ]}
      />
    </Card>
  );
}
