'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { useLocalStorageCache, isCacheValid } from './useLocalStorageCache';

export type NewsTab = 'all' | 'holdings';

const TAB_TO_PATH: Record<NewsTab, string> = {
  all: '/news',
  holdings: '/news/holdings-impact'
};

const CACHE_TTL = 15 * 60 * 1000;

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
}

export function useNews() {
  const [tab, setTab] = useState<NewsTab>('all');
  const [data, setData] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getCached, setCached } = useLocalStorageCache();

  useEffect(() => {
    const cacheKey = `cache_news_${tab}`;
    const cached = getCached<{ items: NewsRow[] }>(cacheKey);

    if (isCacheValid(cached, CACHE_TTL)) {
      setData(cached!.data.items);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchApi<{ items: NewsRow[] }>(TAB_TO_PATH[tab])
      .then((payload) => {
        if (!cancelled) {
          setData(payload.items);
          setCached(cacheKey, payload);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tab, getCached, setCached]);

  return { tab, setTab, data, loading, error };
}
