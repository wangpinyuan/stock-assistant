'use client';

import { useEffect, useState } from 'react';
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

const CACHE_TTL = 60 * 60 * 1000;

export function useFundFlow() {
  const [tab, setTab] = useState<FundFlowTab>('inflows');
  const [data, setData] = useState<FundFlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getCached, setCached } = useLocalStorageCache();

  useEffect(() => {
    const cacheKey = `cache_fund_flow_${tab}`;
    const cached = getCached<{ items: FundFlowRow[] }>(cacheKey);

    if (isCacheValid(cached, CACHE_TTL)) {
      setData(cached!.data.items);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchApi<{ items: FundFlowRow[] }>(TAB_TO_PATH[tab])
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

  return { tab, setTab, data, loading, error, tabLabel: TAB_LABEL };
}
