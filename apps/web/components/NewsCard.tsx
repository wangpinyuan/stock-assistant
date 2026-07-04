'use client';

import { Alert, Card, Empty, Skeleton, Space, Table, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { NewsRow } from '../hooks/useNews';

interface Props {
  tab: 'all' | 'holdings';
  data: NewsRow[];
  loading: boolean;
  error: string | null;
  onTabChange: (tab: 'all' | 'holdings') => void;
}

const columns: ColumnsType<NewsRow> = [
  {
    title: '标题',
    dataIndex: 'title',
    width: 150,
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
  { title: '类型', dataIndex: 'type', width: 150 },
  { title: '来源', dataIndex: 'source', width: 150, render: (v: string | null) => v ?? '-' },
  { title: '发布时间', dataIndex: 'publishDate', width: 150, render: (v: string) => new Date(v).toLocaleString() }
];

export function NewsCard({ tab, data, loading, error, onTabChange }: Props) {
  return (
    <Card title="资讯">
      <Tabs
        size="small"
        activeKey={tab}
        onChange={(key) => onTabChange(key as 'all' | 'holdings')}
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
        <Empty description="暂无资讯" />
      ) : (
        <Table rowKey="id" dataSource={data} pagination={{ pageSize: 10 }} size="small" columns={columns} />
      )}
    </Card>
  );
}
