'use client';

import { useEffect, useState } from 'react';
import { Alert, Card, Col, Progress, Row, Skeleton, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchApi } from '../../lib/api';
import { ProfitText } from '../../components/ProfitText';

interface Breadth {
  tradeDate: string | null;
  upCount: number;
  downCount: number;
  flatCount: number;
  limitUpCount: number;
  limitDownCount: number;
  totalCount: number;
}

interface IndexQuote {
  code: string;
  name: string;
  currentPrice: number | null;
  changeAmount: number | null;
  changePercent: number | null;
}

interface SectorFlow {
  name: string;
  changePercent: number | null;
  mainNetInflow: number | null;
  stockCount: number;
}

interface OverviewResponse {
  sentiment: 'bull' | 'bear' | 'neutral';
  indexes: IndexQuote[];
  sectors: SectorFlow[];
  breadth: Breadth;
}

export default function MarketPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<OverviewResponse>('/market/overview')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton active />;
  if (error) return <Alert type="error" message="市场数据加载失败" description={error} />;
  if (!data) return null;

  const breadth = data.breadth;
  const total = breadth.totalCount || 1;
  const upRatio = (breadth.upCount / total) * 100;
  const downRatio = (breadth.downCount / total) * 100;

  const sentimentLabel: Record<OverviewResponse['sentiment'], string> = {
    bull: '偏多',
    bear: '偏空',
    neutral: '中性'
  };

  const indexColumns: ColumnsType<IndexQuote> = [
    { title: '名称', dataIndex: 'name' },
    { title: '代码', dataIndex: 'code', width: 100 },
    { title: '点位', dataIndex: 'currentPrice', align: 'right', render: (v: number | null) => v?.toFixed(2) ?? '-' },
    { title: '涨跌', dataIndex: 'changeAmount', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} />) },
    { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) }
  ];

  const sectorColumns: ColumnsType<SectorFlow> = [
    { title: '板块', dataIndex: 'name' },
    { title: '股票数', dataIndex: 'stockCount', width: 100, align: 'right' },
    { title: '平均涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2} style={{ margin: 0 }}>市场概览</Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={8}>
          <Card title="市场情绪">
            <Space direction="vertical">
              <Typography.Text>当前倾向：<Typography.Text strong>{sentimentLabel[data.sentiment]}</Typography.Text></Typography.Text>
              <Typography.Text type="secondary">数据日期：{breadth.tradeDate ?? '暂无'}</Typography.Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={8}>
          <Card title="涨跌家数">
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
              <Progress
                percent={upRatio}
                success={{ percent: downRatio, strokeColor: '#389e0d' }}
                showInfo={false}
                strokeColor="#cf1322"
              />
              <Typography.Text type="secondary">涨停 {breadth.limitUpCount} · 跌停 {breadth.limitDownCount} · 平盘 {breadth.flatCount}</Typography.Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={24} xl={8}>
          <Card title="主要指数">
            <Table rowKey="code" dataSource={data.indexes} pagination={false} size="small" columns={indexColumns} />
          </Card>
        </Col>
      </Row>

      <Card title="板块表现">
        <Table rowKey="name" dataSource={data.sectors} pagination={false} size="small" columns={sectorColumns} />
      </Card>
    </Space>
  );
}
