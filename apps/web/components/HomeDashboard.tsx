'use client';

import { useEffect, useState } from 'react';
import { Alert, Card, Col, Row, Space, Spin, Table, Typography } from 'antd';
import { fetchApi } from '../lib/api';
import { MetricCard } from './MetricCard';
import { ProfitText } from './ProfitText';
import type { HoldingView, PortfolioSummary } from '@stock-assistant/shared';

const percent = (value: number) => `${(value * 100).toFixed(2)}%`;

export function HomeDashboard() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<HoldingView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi<PortfolioSummary>('/portfolio/summary'),
      fetchApi<{ items: HoldingView[] }>('/holdings')
    ])
      .then(([summaryData, holdingsData]) => {
        setSummary(summaryData);
        setHoldings(holdingsData.items);
      })
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : '数据加载失败');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Spin />;
  }

  if (error || !summary) {
    return <Alert type="error" message="首页数据加载失败" description={error ?? '请确认 API 服务已启动。'} />;
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>投资组合总览</Typography.Title>
        <Typography.Text type="secondary">最近更新时间：{summary.updatedAt ?? '暂无'}</Typography.Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} xl={4}><MetricCard title="总市值" value={summary.totalMarketValue} prefix="¥" /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="今日盈亏" value={summary.todayProfit} prefix="¥" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="今日盈亏率" value={summary.todayProfitRate * 100} suffix="%" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="总盈亏" value={summary.totalProfit} prefix="¥" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="总盈亏率" value={summary.totalProfitRate * 100} suffix="%" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="持仓数量" value={`${summary.holdingCount} 个`} /></Col>
      </Row>

      <Card title="持仓明细">
        <Table
          rowKey="id"
          dataSource={holdings}
          pagination={false}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '代码', dataIndex: 'code' },
            { title: '类型', dataIndex: 'assetType', render: (value) => value === 'stock' ? '股票' : 'ETF' },
            { title: '当前价', dataIndex: 'currentPrice', align: 'right', render: (value: number) => value.toFixed(2) },
            { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (value: number) => <ProfitText value={value} suffix="%" /> },
            { title: '持仓数量', dataIndex: 'quantity', align: 'right' },
            { title: '平均成本', dataIndex: 'averageCost', align: 'right', render: (value: number) => value.toFixed(2) },
            { title: '当前市值', dataIndex: 'marketValue', align: 'right', render: (value: number) => value.toFixed(2) },
            { title: '持仓比例', dataIndex: 'weight', align: 'right', render: percent },
            { title: '今日盈亏', dataIndex: 'todayProfit', align: 'right', render: (value: number) => <ProfitText value={value} /> },
            { title: '总盈亏', dataIndex: 'totalProfit', align: 'right', render: (value: number) => <ProfitText value={value} /> }
          ]}
        />
      </Card>
    </Space>
  );
}
