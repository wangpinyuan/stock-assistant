'use client';

import { Alert, Card, Empty, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { NewsRow } from '../hooks/useNews';

interface Props {
  tab: 'all' | 'holdings';
  data: NewsRow[];
  loading: boolean;
  error: string | null;
  lastUpdateTime: Date | null;
  refreshIntervalMinutes: number;
  onTabChange: (tab: 'all' | 'holdings') => void;
}

const columns: ColumnsType<NewsRow> = [
  {
    title: '标题',
    dataIndex: 'title',
    width: 240,
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
  { title: '板块', dataIndex: 'sectors', width: 80, render: (v: string | null) => v ? <Tag>{v}</Tag> : '-' },
  { title: '类型', dataIndex: 'type', width: 80 },
  { title: '来源', dataIndex: 'source', width: 100, render: (v: string | null) => v ?? '-' },
  { title: '发布时间', dataIndex: 'publishDate', width: 130, render: (v: string) => new Date(v).toLocaleString() }
];

export function NewsCard({ tab, data, loading, error, lastUpdateTime, refreshIntervalMinutes, onTabChange }: Props) {
  const lastUpdateText = lastUpdateTime ? `更新时间：${lastUpdateTime.toLocaleTimeString()}` : '数据加载中...';
  return (
    <Card
      title="资讯"
      extra={<Space size="small"><Typography.Text type="secondary" style={{ fontSize: 12 }}>{lastUpdateText}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 12 }}>每{refreshIntervalMinutes}分钟自动更新</Typography.Text></Space>}
    >
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
