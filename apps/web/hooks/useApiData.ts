'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApi } from '../lib/api';

export function useApiData<T>(path: string, refreshVersion = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentPath = useRef(path);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  currentPath.current = path;

  const reload = useCallback(async () => {
    if (!mounted.current) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const id = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<T>(currentPath.current, { signal: request.signal });
      if (mounted.current && id === sequence.current) setData(result);
    } catch (reason) {
      if (mounted.current && id === sequence.current && !request.signal.aborted) {
        setError(reason instanceof Error ? reason.message : '加载失败');
      }
    } finally {
      if (mounted.current && id === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setData(null);
    void reload();
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, [path, reload, refreshVersion]);

  return { data, loading, error, reload };
}
