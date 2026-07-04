'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApi, postApi } from '../lib/api';
import { useLocalStorageCache, isCacheValid } from './useLocalStorageCache';
import type { Breadth, IndexQuote } from '@stock-assistant/shared';

const AUTO_REFRESH_INTERVAL = 30 * 60 * 1000;
const CACHE_KEY = 'cache_market_overview';
const CACHE_TTL = 30 * 60 * 1000;

export interface MarketOverviewData {
  sentiment: 'bull' | 'bear' | 'neutral';
  indexes: IndexQuote[];
  breadth: Breadth;
}

export function useMarketOverview() {
  const [data, setData] = useState<MarketOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [updating, setUpdating] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { getCached, setCached } = useLocalStorageCache();

  const load = useCallback(async (showLoading = true, forceRefresh = false) => {
    const cached = getCached<MarketOverviewData>(CACHE_KEY);

    if (!forceRefresh && isCacheValid(cached, CACHE_TTL)) {
      setData(cached!.data);
      setLastUpdateTime(new Date(cached!.timestamp));
      if (showLoading) setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<MarketOverviewData>('/market/overview');
      setData(result);
      setLastUpdateTime(new Date());
      setCached(CACHE_KEY, result, result.breadth?.tradeDate ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [getCached, setCached]);

  const refresh = useCallback(async () => {
    setUpdating(true);
    try {
      await postApi<{ ok: boolean; error?: string }>('/update/quotes', { source: 'sina' });
      await load(false, true);
    } catch (err) {
      console.error('Failed to update market data:', err);
    } finally {
      setUpdating(false);
    }
  }, [load]);

  useEffect(() => {
    load();

    timerRef.current = setInterval(() => {
      const cached = getCached<MarketOverviewData>(CACHE_KEY);
      if (cached && isCacheValid(cached, CACHE_TTL)) return;
      refresh();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load, refresh, getCached]);

  return { data, loading, error, lastUpdateTime, updating, refresh };
}
