'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { postApi } from '../../lib/api';

type UpdateKind = 'market' | 'fund-flow' | 'news';

export function useDataUpdate(kind: UpdateKind | readonly UpdateKind[], reload: () => Promise<void>, needsInitialData = false, refreshVersion = 0) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const initialAttempted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { setError(null); }, [refreshVersion]);
  const update = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setUpdating(true);
    setError(null);
    try {
      const kinds = typeof kind === 'string' ? [kind] : kind;
      const results = await Promise.allSettled(kinds.map(async updateKind => {
        const result = await postApi<{ ok: boolean; error?: string }>(`/update/${updateKind}`, updateKind === 'market' ? { source: 'sina' } : {});
        if (!result.ok) throw new Error(result.error ?? '更新失败');
      }));
      const failures = results.flatMap(result => result.status === 'rejected'
        ? [result.reason instanceof Error ? result.reason.message : '更新失败']
        : []);
      if (mounted.current && (typeof kind !== 'string' || failures.length === 0)) await reload();
      if (failures.length > 0) throw new Error([...new Set(failures)].join('\n'));
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : '更新失败');
    } finally {
      busy.current = false;
      if (mounted.current) setUpdating(false);
    }
  }, [kind, reload]);
  useEffect(() => {
    if (needsInitialData && !initialAttempted.current) {
      initialAttempted.current = true;
      void update();
    }
  }, [needsInitialData, update]);
  const clearError = useCallback(() => setError(null), []);
  return { update, updating, error, clearError };
}
