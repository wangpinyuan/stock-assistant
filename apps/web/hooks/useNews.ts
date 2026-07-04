'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '../lib/api';
import { useLocalStorageCache, isCacheValid } from './useLocalStorageCache';

export type NewsTab = 'all' | 'holdings';

const TAB_TO_PATH: Record<NewsTab, string> = {
  all: '/news',
  holdings: '/news/holdings-impact'
};

const CACHE_TTL = 5 * 60 * 1000;

export interface NewsRow {
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
  sectors: string | null;
}

export function useNews() {
  const [tab, setTab] = useState<NewsTab>('all');
  const [data, setData] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const { getCached, setCached } = useLocalStorageCache();

  const load = useCallback(async (showLoading = true, forceRefresh = false) => {
    const cacheKey = `cache_news_${tab}`;
    const cached = getCached<{ items: NewsRow[] }>(cacheKey);

    if (!forceRefresh && isCacheValid(cached, CACHE_TTL)) {
      setData(cached!.data.items);
      setLastUpdateTime(new Date(cached!.timestamp));
      if (showLoading) setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    fetchApi<{ items: NewsRow[] }>(TAB_TO_PATH[tab])
      .then((payload) => {
        setData(payload.items);
        setLastUpdateTime(new Date());
        setCached(cacheKey, payload);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  }, [tab, getCached, setCached]);

  useEffect(() => {
    load();
  }, [load]);

  return { tab, setTab, data, loading, error, lastUpdateTime, refresh: () => load(false, true) };
}
