'use client';

import { Alert, Card, Col, Divider, Progress, Row, Skeleton, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { IndexQuote } from '@stock-assistant/shared';
import { ProfitText } from './ProfitText';
import type { MarketOverviewData } from '../hooks/useMarketOverview';

interface Props {
  data: MarketOverviewData | null;
  loading: boolean;
  error: string | null;
  lastUpdateTime: Date | null;
  refreshIntervalMinutes: number;
  updating: boolean;
  onRefresh: () => void;
  onNameClick: (code: string, name: string) => void;
  onBreadthClick: (type: 'limitUp' | 'limitDown' | 'strong' | 'weak', label: string) => void;
}

const indexColumns = (onNameClick: (code: string, name: string) => void): ColumnsType<IndexQuote> => [
  { title: '名称', dataIndex: 'name', width: 150, render: (v: string, row) => <span style={{ color: '#1677ff', cursor: 'pointer' }} onClick={() => onNameClick(row.code, v)}>{v}</span> },
  { title: '点位', dataIndex: 'currentPrice', align: 'right', width: 150, render: (v: number | null) => v?.toFixed(2) ?? '-' },
  { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', width: 150, render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) }
];

export function MarketOverviewCard({ data, loading, error, lastUpdateTime, refreshIntervalMinutes, updating, onRefresh, onNameClick, onBreadthClick }: Props) {
  if (loading) return <Skeleton active />;
  if (error) return <Alert type="error" message="市场数据加载失败" description={error} />;
  if (!data) return null;

  const breadth = data.breadth;
  const total = breadth.totalCount || 1;
  const upRatio = (breadth.upCount / total) * 100;
  const downRatio = (breadth.downCount / total) * 100;

  const lastUpdateText = lastUpdateTime
    ? `更新时间：${lastUpdateTime.toLocaleTimeString()}`
    : '数据加载中...';

  return (
    <Row gutter={[16, 16]} align="stretch">
      <Col xs={24} md={12}>
        <Card
          title="涨跌家数"
          extra={
            <Space size="small">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{lastUpdateText}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>每{refreshIntervalMinutes}分钟自动更新</Typography.Text>
            </Space>
          }
          style={{ height: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row>
              <Col span={12}>
                <Typography.Text type="secondary">上涨</Typography.Text>
                <div style={{ fontSize: 20, color: '#cf1322' }}>{breadth.upCount}</div>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary">下跌</Typography.Text>
                <div style={{ fontSize: 20, color: '#389e0d' }}>{breadth.downCount}</div>
              </Col>
            </Row>
            <Progress percent={upRatio} success={{ percent: downRatio, strokeColor: '#389e0d' }} showInfo={false} strokeColor="#cf1322" />
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="secondary">涨停</Typography.Text>
                <div style={{ fontSize: 16, color: '#cf1322', cursor: 'pointer' }} onClick={() => onBreadthClick('limitUp', '涨停股票')}>{breadth.limitUpCount}</div>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary">跌停</Typography.Text>
                <div style={{ fontSize: 16, color: '#389e0d', cursor: 'pointer' }} onClick={() => onBreadthClick('limitDown', '跌停股票')}>{breadth.limitDownCount}</div>
              </Col>
            </Row>
            <Divider style={{ margin: '8px 0' }} />
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="secondary">强势（涨&gt;3%）</Typography.Text>
                <div style={{ fontSize: 16, color: '#cf1322', cursor: 'pointer' }} onClick={() => onBreadthClick('strong', '强势股票')}>{breadth.strongCount}</div>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary">弱势（跌&gt;3%）</Typography.Text>
                <div style={{ fontSize: 16, color: '#389e0d', cursor: 'pointer' }} onClick={() => onBreadthClick('weak', '弱势股票')}>{breadth.weakCount}</div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="secondary">均价上涨</Typography.Text>
                <div style={{ fontSize: 16, color: '#cf1322' }}>{breadth.avgUpCount}</div>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary">均价下跌</Typography.Text>
                <div style={{ fontSize: 16, color: '#389e0d' }}>{breadth.avgDownCount}</div>
              </Col>
            </Row>
          </Space>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card
          title="主要指数"
          style={{ height: '100%' }}
          extra={
            <Space size="small">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{lastUpdateText}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>每{refreshIntervalMinutes}分钟自动更新</Typography.Text>
            </Space>
          }
        >
          <Table rowKey="code" dataSource={data.indexes} pagination={false} size="small" columns={indexColumns(onNameClick)} />
        </Card>
      </Col>
    </Row>
  );
}
