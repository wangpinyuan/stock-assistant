'use client';

import { Alert, Col, Row, Typography } from 'antd';
import { MetricCard } from './MetricCard';
import type { PortfolioSummary } from '@stock-assistant/shared';

interface PortfolioSummaryProps {
  summary: PortfolioSummary;
}

export function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  return (
    <>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>投资组合总览</Typography.Title>
        <Typography.Text type="secondary">最近更新时间：{summary.updatedAt ?? '暂无'}</Typography.Text>
      </div>

      {summary.missingQuoteCount > 0 && <Alert type="warning" message={`缺少 ${summary.missingQuoteCount} 笔持仓行情，已知市值 ¥${summary.knownMarketValue.toFixed(2)}，覆盖 ${(summary.quoteCoverage * 100).toFixed(0)}%`} />}
      {summary.mixedQuoteDates && <Alert type="warning" message="持仓行情日期不一致，当日盈亏暂不可用" />}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} xl={4}><MetricCard title="总市值" value={summary.totalMarketValue} prefix="¥" /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="今日盈亏" value={summary.todayProfit} prefix="¥" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="今日盈亏率" value={summary.todayProfitRate == null ? null : summary.todayProfitRate * 100} suffix="%" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="总盈亏" value={summary.totalProfit} prefix="¥" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="总盈亏率" value={summary.totalProfitRate == null ? null : summary.totalProfitRate * 100} suffix="%" profitColor /></Col>
        <Col xs={24} md={8} xl={4}><MetricCard title="持仓数量" value={`${summary.holdingCount} 个`} /></Col>
      </Row>
    </>
  );
}
