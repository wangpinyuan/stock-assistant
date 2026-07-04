'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchApi, putApi, deleteApi, postApi } from '../lib/api';
import { DEFAULT_CLAUDE_MODEL, DEEP_CLAUDE_MODEL } from '@stock-assistant/shared';

export interface SettingEntry {
  id: number;
  key: string;
  value: string;
  updatedAt: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<SettingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<{ items: SettingEntry[] }>('/settings');
      setSettings(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const saveItems = useCallback(async (items: Array<{ key: string; value: string }>) => {
    await putApi('/settings', { items });
    await load();
  }, [load]);

  const remove = useCallback(async (key: string) => {
    await deleteApi(`/settings?key=${encodeURIComponent(key)}`);
    await load();
  }, [load]);

  const getModelDefaults = useCallback(() => ({
    defaultModel: settings.find((s) => s.key === 'claude.defaultModel')?.value ?? DEFAULT_CLAUDE_MODEL,
    deepModel: settings.find((s) => s.key === 'claude.deepModel')?.value ?? DEEP_CLAUDE_MODEL
  }), [settings]);

  return { settings, loading, error, load, saveItems, remove, getModelDefaults };
}
