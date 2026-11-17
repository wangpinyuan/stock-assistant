'use client';
import { useState } from 'react';
import { Alert, Card, Empty, Skeleton, Space, Table, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { NewsItemView } from '@stock-assistant/shared';
import { useApiData } from '../../hooks/useApiData';
import { useDataUpdate } from './useDataUpdate';

const newsColumns: ColumnsType<NewsItemView> = [
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
  { title: '来源', dataIndex: 'source', width: 120, render: (v: string | null) => v ?? '-' },
  { title: '发布时间', dataIndex: 'publishDate', width: 160, render: (v: string) => new Date(v).toLocaleString() }
];

type NewsTab = 'all' | 'holdings';
export function NewsPanel({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [newsTab, setNewsTab] = useState<NewsTab>('all');
  const resource = useApiData<{ items: NewsItemView[] }>(newsTab === 'all' ? '/news' : '/news/holdings-impact', refreshVersion);
  const mutation = useDataUpdate('news', resource.reload, newsTab === 'all' && resource.data != null && resource.data.items.length === 0, refreshVersion);
  const error = resource.error ?? mutation.error;
  return (
    <Card title="资讯">
      <Tabs
        size="small"
        activeKey={newsTab}
        onChange={(key) => { mutation.clearError(); setNewsTab(key as NewsTab); }}
        items={[
          { key: 'all', label: '全部资讯' },
          { key: 'holdings', label: '持仓影响' }
        ]}
      />
      {resource.loading || mutation.updating ? (
        <Skeleton active />
      ) : error ? (
        <Alert type="error" message="资讯加载失败" description={error} />
      ) : (resource.data?.items ?? []).length === 0 ? (
        <Empty description="暂无资讯" />
      ) : (
        <Table rowKey="id" dataSource={(resource.data?.items ?? [])} pagination={{ pageSize: 10 }} size="small" columns={newsColumns} />
      )}
    </Card>
  );
}
