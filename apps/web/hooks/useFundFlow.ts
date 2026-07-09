'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '../lib/api';
import { useLocalStorageCache, isCacheValid } from './useLocalStorageCache';
import type { FundFlowRow } from '@stock-assistant/shared';

export type FundFlowTab = 'inflows' | 'outflows' | 'sectors' | 'sector-outflows';

const TAB_TO_PATH: Record<FundFlowTab, string> = {
  inflows: '/fund-flow/inflows',
  outflows: '/fund-flow/outflows',
  sectors: '/fund-flow/sectors',
  'sector-outflows': '/fund-flow/sector-outflows'
};

const TAB_LABEL: Record<FundFlowTab, string> = {
  inflows: '个股流入前10',
  outflows: '个股流出前10',
  sectors: '板块流入前20',
  'sector-outflows': '板块流出前20'
};

const CACHE_TTL = 5 * 60 * 1000;

export function useFundFlow() {
  const [tab, setTab] = useState<FundFlowTab>('inflows');
  const [data, setData] = useState<FundFlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const { getCached, setCached } = useLocalStorageCache();

  const load = useCallback(async (showLoading = true, forceRefresh = false) => {
    // Bump the cache key suffix whenever the backend payload shape changes so
    // stale entries (e.g. older 10-row sector outflows) are not reused.
    const cacheKey = `cache_fund_flow_v2_${tab}`;
    const cached = getCached<{ items: FundFlowRow[] }>(cacheKey);

    if (!forceRefresh && isCacheValid(cached, CACHE_TTL)) {
      setData(cached!.data.items);
      setLastUpdateTime(new Date(cached!.timestamp));
      if (showLoading) setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    fetchApi<{ items: FundFlowRow[] }>(TAB_TO_PATH[tab])
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

  return { tab, setTab, data, loading, error, lastUpdateTime, tabLabel: TAB_LABEL, refresh: () => load(false, true) };
}
