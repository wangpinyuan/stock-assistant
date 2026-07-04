import { useCallback, useRef } from 'react';

export interface CachedData<T> {
  data: T;
  timestamp: number;
  tradeDate?: string;
}

const isServer = typeof window === 'undefined';

function getItem<T>(key: string): CachedData<T> | null {
  if (isServer) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedData<T>;
  } catch {
    return null;
  }
}

function setItem<T>(key: string, data: T, tradeDate?: string): void {
  if (isServer) return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now(), tradeDate }));
  } catch {
    // localStorage full or unavailable
  }
}

export function useLocalStorageCache() {
  const statsRef = useRef({ hits: 0, misses: 0, errors: 0 });

  const getCached = useCallback(function <T>(key: string): CachedData<T> | null {
    try {
      const cached = getItem<T>(key);
      if (cached) {
        statsRef.current.hits++;
      } else {
        statsRef.current.misses++;
      }
      return cached;
    } catch {
      statsRef.current.errors++;
      return null;
    }
  }, []);

  const setCached = useCallback(function <T>(
    key: string,
    data: T,
    tradeDate?: string
  ): void {
    setItem(key, data, tradeDate);
  }, []);

  const invalidateCache = useCallback(function (key: string): void {
    if (isServer) return;
    try {
      localStorage.removeItem(key);
    } catch {}
  }, []);

  const getStats = useCallback(() => statsRef.current, []);

  return { getCached, setCached, invalidateCache, getStats };
}

export function isCacheValid<T>(
  cached: CachedData<T> | null,
  ttlMs: number
): boolean {
  if (!cached) return false;

  if (Date.now() - cached.timestamp > ttlMs) return false;

  if (cached.tradeDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (cached.tradeDate !== today) return false;
  }

  return true;
}
