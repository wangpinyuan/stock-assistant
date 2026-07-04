'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchApi, putApi, deleteApi } from '../lib/api';
import { DEFAULT_CLAUDE_MODEL, DEEP_CLAUDE_MODEL, DEFAULT_REFRESH_INTERVAL_MINUTES } from '@stock-assistant/shared';

export interface SettingEntry {
  id: number;
  key: string;
  value: string;
  updatedAt: string;
}

const SETTINGS_CACHE_KEY = 'cache_settings';
const SETTINGS_CACHE_TTL = 5 * 60 * 1000;

export function useSettings() {
  const [settings, setSettings] = useState<SettingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    // Try to load from localStorage first
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < SETTINGS_CACHE_TTL) {
            setSettings(data);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<{ items: SettingEntry[] }>('/settings');
      setSettings(data.items);
      // Cache to localStorage
      try {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ data: data.items, timestamp: Date.now() }));
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveItems = useCallback(async (items: Array<{ key: string; value: string }>) => {
    await putApi('/settings', { items });
    await load(true);
  }, [load]);

  const remove = useCallback(async (key: string) => {
    await deleteApi(`/settings?key=${encodeURIComponent(key)}`);
    await load(true);
  }, [load]);

  const getModelDefaults = useCallback(() => ({
    defaultModel: settings.find((s) => s.key === 'claude.defaultModel')?.value ?? DEFAULT_CLAUDE_MODEL,
    deepModel: settings.find((s) => s.key === 'claude.deepModel')?.value ?? DEEP_CLAUDE_MODEL
  }), [settings]);

  const getRefreshInterval = useCallback(() => {
    const stored = settings.find((s) => s.key === 'app.refreshIntervalMinutes')?.value;
    return stored ? parseInt(stored, 10) : DEFAULT_REFRESH_INTERVAL_MINUTES;
  }, [settings]);

  return { settings, loading, error, load, saveItems, remove, getModelDefaults, getRefreshInterval };
}
