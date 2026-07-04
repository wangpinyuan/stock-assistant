'use client';

import { useEffect, useState, useCallback } from 'react';
import { Alert, Spin, Space, Tabs } from 'antd';
import { fetchApi } from '../lib/api';
import { PortfolioSummary } from './PortfolioSummary';
import { HoldingsTable } from './HoldingsTable';
import { WatchlistTable } from './WatchlistTable';
import type { HoldingView, PortfolioSummary as PortfolioSummaryType, WatchlistView } from '@stock-assistant/shared';

export function HomeDashboard() {
  const [summary, setSummary] = useState<PortfolioSummaryType | null>(null);
  const [holdings, setHoldings] = useState<HoldingView[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('holdings');

  const loadSummary = useCallback(async () => {
    const data = await fetchApi<PortfolioSummaryType>('/portfolio/summary');
    setSummary(data);
  }, []);

  const loadHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    try {
      const data = await fetchApi<{ items: HoldingView[] }>('/holdings');
      setHoldings(data.items);
    } finally {
      setHoldingsLoading(false);
    }
  }, []);

  const loadWatchlist = useCallback(async () => {
    setWatchlistLoading(true);
    try {
      const data = await fetchApi<{ items: WatchlistView[] }>('/watchlist');
      setWatchlist(data.items);
    } finally {
      setWatchlistLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadSummary(), loadHoldings(), loadWatchlist()]);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [loadSummary, loadHoldings, loadWatchlist]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'holdings') {
      loadHoldings();
    } else if (key === 'watchlist') {
      loadWatchlist();
    }
  };

  if (loading) {
    return <Spin />;
  }

  if (error || !summary) {
    return <Alert type="error" message="首页数据加载失败" description={error ?? '请确认 API 服务已启动。'} />;
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <PortfolioSummary summary={summary} />
      <Tabs activeKey={activeTab} onChange={handleTabChange} items={[
        {
          key: 'holdings',
          label: '持仓',
          children: <HoldingsTable holdings={holdings} loading={holdingsLoading} onReload={loadHoldings} />
        },
        {
          key: 'watchlist',
          label: '自选',
          children: <WatchlistTable watchlist={watchlist} loading={watchlistLoading} onReload={loadWatchlist} />
        }
      ]} />
    </Space>
  );
}
