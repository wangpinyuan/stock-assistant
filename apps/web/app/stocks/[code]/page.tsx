'use client';

import { useEffect, useState } from 'react';
import { Alert, Card, Col, Descriptions, Row, Space, Spin, Table, Tabs, Tag, Typography } from 'antd';
import { KLineChart } from '../../../components/KLineChart';
import { ProfitText } from '../../../components/ProfitText';
import { fetchApi } from '../../../lib/api';
import type { HoldingView, NewsItemView, StockAnalysisSignal, StockAnalysisSummary, StockQuoteView } from '@stock-assistant/shared';

interface StockSignalResponse {
  signals: StockAnalysisSignal[];
  summary: StockAnalysisSummary;
}

function toneColor(tone: StockAnalysisSignal['tone']): string {
  if (tone === 'bull') return 'red';
  if (tone === 'bear') return 'green';
  return 'default';
}

export default function StockDetailPage({ params }: { params: { code: string } }) {
  const { code } = params;
  const [quote, setQuote] = useState<StockQuoteView | null>(null);
  const [signalData, setSignalData] = useState<StockSignalResponse | null>(null);
  const [news, setNews] = useState<NewsItemView[]>([]);
  const [holdings, setHoldings] = useState<HoldingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchApi<StockQuoteView | null>(`/stocks/${code}/quote`).catch(() => null),
      fetchApi<StockSignalResponse>(`/stocks/${code}/analysis-signals`).catch(() => null),
      fetchApi<{ items: NewsItemView[] }>(`/stocks/${code}/news`).catch(() => ({ items: [] })),
      fetchApi<{ items: HoldingView[] }>('/holdings').catch(() => ({ items: [] }))
    ])
      .then(([quoteData, signalPayload, newsPayload, holdingsPayload]) => {
        if (cancelled) return;
        setQuote(quoteData);
        setSignalData(signalPayload);
        setNews(newsPayload.items);
        setHoldings(holdingsPayload.items.filter((item) => item.code === code));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return <Spin />;
  }

  if (error) {
    return <Alert type="error" message="个股详情加载失败" description={error} />;
  }

  const summary = signalData?.summary;
  const signals = signalData?.signals ?? [];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Typography.Title level={2} style={{ marginBottom: 4 }}>{code}</Typography.Title>
            <Typography.Text type="secondary">股票代码 {code}</Typography.Text>
          </Col>
          <Col>
            <Space size="large">
              <div style={{ textAlign: 'right' }}>
                <Typography.Text type="secondary">当前价</Typography.Text>
                <div style={{ fontSize: 28, fontWeight: 600 }}>
                  {quote ? quote.currentPrice.toFixed(2) : '-'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Typography.Text type="secondary">今日涨跌</Typography.Text>
                <div style={{ fontSize: 22 }}>
                  {quote ? (
                    <>
                      <ProfitText value={quote.changeAmount ?? 0} />{' '}
                      <ProfitText value={quote.changePercent ?? 0} suffix="%" />
                    </>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      <Tabs
        defaultActiveKey="kline"
        items={[
          {
            key: 'kline',
            label: 'K线',
            children: <KLineChart code={code} />
          },
          {
            key: 'signals',
            label: '技术信号',
            children: (
              <Card>
                {summary && (
                  <Descriptions size="small" column={4} style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="最新收盘">{summary.lastClose.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="MA5">{summary.ma5?.toFixed(2) ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="MA10">{summary.ma10?.toFixed(2) ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="MA20">{summary.ma20?.toFixed(2) ?? '-'}</Descriptions.Item>
                  </Descriptions>
                )}
                <Space wrap>
                  {signals.length === 0 ? (
                    <Typography.Text type="secondary">暂无信号</Typography.Text>
                  ) : (
                    signals.map((signal) => (
                      <Tag key={signal.key} color={toneColor(signal.tone)}>
                        {signal.label} · {signal.detail}
                      </Tag>
                    ))
                  )}
                </Space>
              </Card>
            )
          },
          {
            key: 'news',
            label: `资讯 (${news.length})`,
            children: (
              <Card>
                <Table
                  rowKey="id"
                  dataSource={news}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: '暂无资讯' }}
                  columns={[
                    { title: '标题', dataIndex: 'title' },
                    { title: '类型', dataIndex: 'type', width: 100 },
                    { title: '来源', dataIndex: 'source', width: 120, render: (v: string | null) => v ?? '-' },
                    { title: '时间', dataIndex: 'publishDate', width: 160, render: (v: string) => new Date(v).toLocaleString() }
                  ]}
                />
              </Card>
            )
          },
          {
            key: 'holding',
            label: `持仓视角 (${holdings.length})`,
            children: (
              <Card>
                <Table
                  rowKey="id"
                  dataSource={holdings}
                  pagination={false}
                  locale={{ emptyText: '当前未持有该股票' }}
                  columns={[
                    { title: '数量', dataIndex: 'quantity', align: 'right' },
                    { title: '成本', dataIndex: 'averageCost', align: 'right', render: (v: number) => v.toFixed(2) },
                    { title: '当前市值', dataIndex: 'marketValue', align: 'right', render: (v: number) => v.toFixed(2) },
                    { title: '今日盈亏', dataIndex: 'todayProfit', align: 'right', render: (v: number) => <ProfitText value={v} /> },
                    { title: '总盈亏', dataIndex: 'totalProfit', align: 'right', render: (v: number) => <ProfitText value={v} /> }
                  ]}
                />
              </Card>
            )
          }
        ]}
      />
    </Space>
  );
}
