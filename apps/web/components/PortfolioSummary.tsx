'use client';

import { Col, Row, Typography } from 'antd';
import { MetricCard } from './MetricCard';
import type { PortfolioSummary } from '@stock-assistant/shared';

interface PortfolioSummaryProps {
  summary: PortfolioSummary;
}

export function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  return (
    <>
      <Typography.Title level={2} style={{ marginBottom: 16 }}>投资组合总览</Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} xl={4}><MetricCard title="总市值" value={summary.totalMarketValue} prefix="¥" /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="今日盈亏" value={summary.todayProfit} prefix="¥" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="今日盈亏率" value={summary.todayProfitRate * 100} suffix="%" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="总盈亏" value={summary.totalProfit} prefix="¥" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="总盈亏率" value={summary.totalProfitRate * 100} suffix="%" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="持仓数量" value={`${summary.holdingCount} 个`} /></Col>
      </Row>
    </>
  );
}
