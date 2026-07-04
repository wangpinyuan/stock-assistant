'use client';

import { useMemo } from 'react';
import { useSettings } from './useSettings';
import { DEFAULT_REFRESH_INTERVAL_MINUTES } from '@stock-assistant/shared';

export function useRefreshInterval() {
  const { settings, getRefreshInterval } = useSettings();
  const intervalMinutes = useMemo(() => getRefreshInterval(), [settings, getRefreshInterval]);
  const intervalMs = intervalMinutes * 60 * 1000;
  return { intervalMinutes, intervalMs };
}
