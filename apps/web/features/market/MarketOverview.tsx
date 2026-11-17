'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Divider, Empty, Progress, Row, Skeleton, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ProfitText } from '../../components/ProfitText';
import type { Breadth, IndexQuote, SectorFlow } from '@stock-assistant/shared';
import { useApiData } from '../../hooks/useApiData';
import { useDataUpdate } from './useDataUpdate';

type NameClick = (code: string, name: string) => void;
const indexColumns = (onNameClick: (code: string, name: string) => void): ColumnsType<IndexQuote> => [
  { title: '名称', dataIndex: 'name', render: (v: string, row) => <a onClick={() => onNameClick(row.code, v)}>{v}</a> },
  { title: '点位', dataIndex: 'currentPrice', align: 'right', render: (v: number | null) => v?.toFixed(2) ?? '-' },
  { title: '涨跌', dataIndex: 'changeAmount', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} />) },
  { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) }
];

const sectorColumns: ColumnsType<SectorFlow> = [
  { title: '板块', dataIndex: 'name' },
  { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) }
];

interface OverviewResponse {
  sentiment: 'bull' | 'bear' | 'neutral';
  indexes: IndexQuote[];
  sectors: SectorFlow[];
  breadth: Breadth;
}
export function MarketOverview({ onNameClick, refreshVersion = 0 }: { onNameClick: NameClick; refreshVersion?: number }) {
  const resource = useApiData<OverviewResponse>('/market/overview', refreshVersion);
  const mutation = useDataUpdate('market', resource.reload, false, refreshVersion);
  const sectorMutation = useDataUpdate('fund-flow', resource.reload, resource.data != null && resource.data.sectors.length === 0, refreshVersion);
  const updateMarket = mutation.update;
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => { if (resource.data) setLoadedAt(new Date()); }, [resource.data]);
  useEffect(() => {
    const timer = setInterval(() => { void updateMarket(); }, 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, [updateMarket]);
  if (resource.loading && !resource.data) return <Skeleton active />;
  if (resource.error || mutation.error) return <Alert type="error" message="市场数据加载失败" description={resource.error ?? mutation.error} action={<Button onClick={mutation.update}>重试</Button>} />;
  if (!resource.data) return null;
    const breadth = resource.data.breadth;
    const total = breadth.totalCount || 1;
    const upRatio = (breadth.upCount / total) * 100;
    const downRatio = (breadth.downCount / total) * 100;

    const lastUpdateText = loadedAt
      ? `更新时间：${loadedAt.toLocaleTimeString()}`
      : '数据加载中...';

    return (
      <>
        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} md={12}>
            <Card
              title="涨跌家数"
              extra={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{lastUpdateText}</Typography.Text>
              }
              style={{ height: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Text type="secondary">{breadth.scope} · 交易日 {breadth.tradeDate ?? '暂无'} · 缺失 {breadth.missingCount} 只</Typography.Text>
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
                    <Typography.Text type="secondary">涨停估算</Typography.Text>
                    <div style={{ fontSize: 16, color: '#cf1322' }}>{breadth.limitUpCount}</div>
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="secondary">跌停估算</Typography.Text>
                    <div style={{ fontSize: 16, color: '#389e0d' }}>{breadth.limitDownCount}</div>
                  </Col>
                </Row>
                <Divider style={{ margin: '8px 0' }} />
                <Row>
                  <Col span={12}>
                    <Typography.Text type="secondary">强势（涨&gt;3%）</Typography.Text>
                    <div style={{ fontSize: 16, color: '#cf1322' }}>{breadth.strongCount}</div>
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="secondary">弱势（跌&gt;3%）</Typography.Text>
                    <div style={{ fontSize: 16, color: '#389e0d' }}>{breadth.weakCount}</div>
                  </Col>
                </Row>
                <Row>
                  <Col span={12}>
                    <Typography.Text type="secondary">均价上涨</Typography.Text>
                    <div style={{ fontSize: 16, color: '#cf1322' }}>{breadth.avgUpCount}</div>
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="secondary">均价下跌</Typography.Text>
                    <div style={{ fontSize: 16, color: '#389e0d' }}>{breadth.avgDownCount}</div>
                  </Col>
                </Row>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>每30分钟自动更新</Typography.Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="主要指数" style={{ height: '100%' }}>
              <Table rowKey="code" dataSource={resource.data.indexes} pagination={false} size="small" columns={indexColumns(onNameClick)} />
            </Card>
          </Col>
        </Row>
        <Card title="板块表现" style={{ marginTop: 24, maxHeight: 500, overflowY: 'auto' }}>
          <Typography.Paragraph type="secondary">概念板块 · 交易日 {resource.data.sectors[0]?.tradeDate ?? '暂无'}</Typography.Paragraph>
          {sectorMutation.updating ? <Skeleton active /> : sectorMutation.error ? (
            <Alert type="error" message="板块数据更新失败" description={sectorMutation.error} />
          ) : resource.data.sectors.length === 0 ? <Empty description="暂无板块数据" /> : (
            <Table rowKey="name" dataSource={resource.data.sectors} pagination={false} size="small" columns={sectorColumns} />
          )}
        </Card>
      </>
    );
}
