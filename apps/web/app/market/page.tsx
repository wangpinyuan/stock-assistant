'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert, Button, Card, Col, Divider, Empty, Progress, Row, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchApi, postApi } from '../../lib/api';
import { ProfitText } from '../../components/ProfitText';
import { StockKLineModal } from '../../components/StockKLineModal';
import { formatLargeNumber } from '@stock-assistant/shared';
import type { Breadth, IndexQuote, SectorFlow, FundFlowRow } from '@stock-assistant/shared';

// ==================== Market Overview ====================
interface OverviewResponse {
  sentiment: 'bull' | 'bear' | 'neutral';
  indexes: IndexQuote[];
  sectors: SectorFlow[];
  breadth: Breadth;
}

// ==================== Fund Flow ====================
type FundFlowTab = 'inflows' | 'outflows' | 'sectors';

const FUND_FLOW_TAB_TO_PATH: Record<FundFlowTab, string> = {
  inflows: '/fund-flow/inflows',
  outflows: '/fund-flow/outflows',
  sectors: '/fund-flow/sectors'
};

const FUND_FLOW_TAB_LABEL: Record<FundFlowTab, string> = {
  inflows: '流入前10',
  outflows: '流出前10',
  sectors: '板块'
};

// ==================== News ====================
interface NewsRow {
  id: number;
  type: string;
  code: string | null;
  title: string;
  source: string | null;
  publishDate: string;
  url: string | null;
  summary: string | null;
  sentiment: string;
  impactOnHolding: boolean;
}

type NewsTab = 'all' | 'holdings';

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'red',
  negative: 'green',
  neutral: 'default'
};

// ==================== Columns ====================
const indexColumns = (onNameClick: (code: string, name: string) => void): ColumnsType<IndexQuote> => [
  { title: '名称', dataIndex: 'name', render: (v: string, row) => <a onClick={() => onNameClick(row.code, v)}>{v}</a> },
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

const fundFlowColumns = (onNameClick: (code: string, name: string) => void): ColumnsType<FundFlowRow> => [
  { title: '名称', dataIndex: 'name', render: (v: string | null, row) => v ? <a onClick={() => row.code && onNameClick(row.code, v)}>{v}</a> : '-' },
  { title: '代码', dataIndex: 'code', width: 90 },
  { title: '日期', dataIndex: 'flowDate', width: 100 },
  { title: '净流入', dataIndex: 'mainNetInflow', align: 'right', render: (v: number | null) => {
    if (v == null) return '-';
    const formatted = formatLargeNumber(Math.abs(v));
    return <span style={{ color: v > 0 ? '#cf1322' : '#389e0d' }}>{v > 0 ? '+' : ''}{formatted}</span>;
  }},
  { title: '成交量', dataIndex: 'largeOrderNetInflow', align: 'right', render: (v: number | null) => {
    if (v == null) return '-';
    return formatLargeNumber(Math.abs(v));
  }},
  { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) }
];

const newsColumns: ColumnsType<NewsRow> = [
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
  { title: '代码', dataIndex: 'code', width: 100, render: (v: string | null) => v ?? '-' },
  { title: '情绪', dataIndex: 'sentiment', width: 100, render: (v: string) => <Tag color={SENTIMENT_COLOR[v] ?? 'default'}>{v}</Tag> },
  { title: '来源', dataIndex: 'source', width: 120, render: (v: string | null) => v ?? '-' },
  { title: '发布时间', dataIndex: 'publishDate', width: 160, render: (v: string) => new Date(v).toLocaleString() }
];

// ==================== Main Component ====================
const AUTO_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

export default function MarketPage() {
  // Market state
  const [marketData, setMarketData] = useState<OverviewResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [marketUpdating, setMarketUpdating] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fund flow state
  const [fundFlowTab, setFundFlowTab] = useState<FundFlowTab>('inflows');
  const [fundFlowData, setFundFlowData] = useState<FundFlowRow[]>([]);
  const [fundFlowLoading, setFundFlowLoading] = useState(true);
  const [fundFlowError, setFundFlowError] = useState<string | null>(null);
  const [fundFlowUpdating, setFundFlowUpdating] = useState(false);

  // News state
  const [newsTab, setNewsTab] = useState<NewsTab>('all');
  const [newsData, setNewsData] = useState<NewsRow[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsUpdating, setNewsUpdating] = useState(false);

  // K线弹框 state
  const [klineModalOpen, setKlineModalOpen] = useState(false);
  const [selectedStockCode, setSelectedStockCode] = useState('');
  const [selectedStockName, setSelectedStockName] = useState('');

  // Load market data
  const loadMarketData = useCallback(async (showLoading = true) => {
    if (showLoading) setMarketLoading(true);
    setMarketError(null);
    try {
      const data = await fetchApi<OverviewResponse>('/market/overview');
      setMarketData(data);
      setLastUpdateTime(new Date());
    } catch (err) {
      setMarketError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (showLoading) setMarketLoading(false);
    }
  }, []);

  // Trigger market data update (POST to backend)
  const triggerMarketUpdate = async () => {
    setMarketUpdating(true);
    try {
      await postApi<{ ok: boolean; error?: string }>('/update/quotes', { source: 'sina' });
      await loadMarketData(false);
    } catch (err) {
      console.error('Failed to update market data:', err);
    } finally {
      setMarketUpdating(false);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    loadMarketData();

    // Set up auto-refresh timer
    timerRef.current = setInterval(() => {
      triggerMarketUpdate();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [loadMarketData]);

  // Load fund flow data
  useEffect(() => {
    let cancelled = false;
    setFundFlowLoading(true);
    setFundFlowError(null);
    fetchApi<{ items: FundFlowRow[] }>(FUND_FLOW_TAB_TO_PATH[fundFlowTab])
      .then((payload) => {
        if (!cancelled) setFundFlowData(payload.items);
      })
      .catch((err) => {
        if (!cancelled) setFundFlowError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setFundFlowLoading(false);
      });
    return () => { cancelled = true; };
  }, [fundFlowTab]);

  // Load news data
  useEffect(() => {
    let cancelled = false;
    setNewsLoading(true);
    setNewsError(null);
    const path = newsTab === 'all' ? '/news' : '/news/holdings-impact';
    fetchApi<{ items: NewsRow[] }>(path)
      .then((payload) => {
        if (!cancelled) setNewsData(payload.items);
      })
      .catch((err) => {
        if (!cancelled) setNewsError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setNewsLoading(false);
      });
    return () => { cancelled = true; };
  }, [newsTab]);

  // Handlers
  const triggerFundFlowUpdate = async () => {
    setFundFlowUpdating(true);
    try {
      const result = await postApi<{ ok: boolean; error?: string }>('/update/fund-flow', {});
      if (result.ok) {
        // success
      } else {
        console.warn(result.error ?? '资金流更新功能尚未接入');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFundFlowUpdating(false);
    }
  };

  const triggerNewsUpdate = async () => {
    setNewsUpdating(true);
    try {
      const result = await postApi<{ ok: boolean; error?: string }>('/update/news', {});
      if (result.ok) {
        // success
      } else {
        console.warn(result.error ?? '资讯更新功能尚未接入');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setNewsUpdating(false);
    }
  };

  // K线弹框点击处理
  const handleFundFlowNameClick = (code: string, name: string) => {
    setSelectedStockCode(code);
    setSelectedStockName(name);
    setKlineModalOpen(true);
  };

  // Render market section
  const renderMarket = () => {
    if (marketLoading) return <Skeleton active />;
    if (marketError) return <Alert type="error" message="市场数据加载失败" description={marketError} />;
    if (!marketData) return null;

    const breadth = marketData.breadth;
    const total = breadth.totalCount || 1;
    const upRatio = (breadth.upCount / total) * 100;
    const downRatio = (breadth.downCount / total) * 100;

    const lastUpdateText = lastUpdateTime
      ? `更新时间：${lastUpdateTime.toLocaleTimeString()}`
      : '数据加载中...';

    return (
      <>
        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} md={12}>
            <Card
              title="涨跌家数"
              extra={
                <Space size="small">
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{lastUpdateText}</Typography.Text>
                  <Button size="small" loading={marketUpdating} onClick={triggerMarketUpdate}>刷新</Button>
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
                    <div style={{ fontSize: 16, color: '#cf1322' }}>{breadth.limitUpCount}</div>
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="secondary">跌停</Typography.Text>
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
              <Table rowKey="code" dataSource={marketData.indexes} pagination={false} size="small" columns={indexColumns(handleFundFlowNameClick)} />
            </Card>
          </Col>
        </Row>
        <Card title="板块表现">
          <Table rowKey="name" dataSource={marketData.sectors} pagination={false} size="small" columns={sectorColumns} />
        </Card>
      </>
    );
  };

  // Render fund flow section
  const renderFundFlow = () => (
    <Card
      title="资金流"
      extra={<Button size="small" loading={fundFlowUpdating} onClick={triggerFundFlowUpdate}>更新</Button>}
    >
      <Tabs
        size="small"
        activeKey={fundFlowTab}
        onChange={(key) => setFundFlowTab(key as FundFlowTab)}
        items={(['inflows', 'outflows', 'sectors'] as FundFlowTab[]).map((key) => ({
          key,
          label: FUND_FLOW_TAB_LABEL[key]
        }))}
      />
      {fundFlowLoading ? (
        <Skeleton active />
      ) : fundFlowError ? (
        <Alert type="error" message="资金流数据加载失败" description={fundFlowError} />
      ) : fundFlowData.length === 0 ? (
        <Empty description="暂无资金流数据" />
      ) : (
        <Table rowKey="id" dataSource={fundFlowData} pagination={{ pageSize: 10 }} size="small" columns={fundFlowColumns(handleFundFlowNameClick)} />
      )}
    </Card>
  );

  // Render news section
  const renderNews = () => (
    <Card
      title="资讯"
      extra={<Button size="small" loading={newsUpdating} onClick={triggerNewsUpdate}>更新</Button>}
    >
      <Tabs
        size="small"
        activeKey={newsTab}
        onChange={(key) => setNewsTab(key as NewsTab)}
        items={[
          { key: 'all', label: '全部资讯' },
          { key: 'holdings', label: '持仓影响' }
        ]}
      />
      {newsLoading ? (
        <Skeleton active />
      ) : newsError ? (
        <Alert type="error" message="资讯加载失败" description={newsError} />
      ) : newsData.length === 0 ? (
        <Empty description="暂无资讯" />
      ) : (
        <Table rowKey="id" dataSource={newsData} pagination={{ pageSize: 10 }} size="small" columns={newsColumns} />
      )}
    </Card>
  );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2} style={{ margin: 0 }}>市场</Typography.Title>
      {renderMarket()}
      {renderFundFlow()}
      {renderNews()}

      <StockKLineModal
        open={klineModalOpen}
        code={selectedStockCode}
        name={selectedStockName}
        onClose={() => setKlineModalOpen(false)}
      />
    </Space>
  );
}
