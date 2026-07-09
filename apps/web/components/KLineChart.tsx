'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Empty, Radio, Space, Spin, Typography } from 'antd';
import type { IChartApi, ISeriesApi, LogicalRange, Time, UTCTimestamp } from 'lightweight-charts';
import { fetchApi } from '../lib/api';
import { toNumber } from '@stock-assistant/shared';
import type { KlineRow } from '@stock-assistant/shared';
import { useLocalStorageCache } from '../hooks/useLocalStorageCache';

type Period = 'daily';

const KLINE_TTL_MS = 24 * 60 * 60 * 1000;

function dateField(row: KlineRow): string {
  return row.tradeDate ?? '';
}

export function KLineChart({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma10Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const chartReadyRef = useRef(false);

  // All loaded kline data
  const allDataRef = useRef<KlineRow[]>([]);
  // True when currently fetching more old data
  const isLoadingMoreRef = useRef(false);
  // Set to true after we've confirmed there are no older bars to load. Prevents
  // the scroll handler from re-triggering loadMore on every tick when the
  // user is already at the start of the dataset.
  const hasReachedStartRef = useRef(false);

  const period: Period = 'daily';
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const { getCached, setCached } = useLocalStorageCache();
  const cacheKey = `cache_kline_${code}_${period}`;

  const buildChartData = useCallback((items: KlineRow[]) => {
    const bars = items.map((row) => {
      const dateStr = dateField(row);
      const ts = Math.floor(new Date(dateStr).getTime() / 1000) as UTCTimestamp;
      return { time: ts as Time, open: toNumber(row.open), high: toNumber(row.high), low: toNumber(row.low), close: toNumber(row.close) };
    });
    const volumeBars = items.map((row, idx) => ({
      time: bars[idx].time,
      value: toNumber(row.volume ?? 0),
      color: toNumber(row.close) >= toNumber(row.open) ? '#cf1322' : '#389e0d'
    }));
    const ma5 = items.map((row, idx) => ({ time: bars[idx].time, value: toNumber(row.ma5 ?? 0) || NaN }));
    const ma10 = items.map((row, idx) => ({ time: bars[idx].time, value: toNumber(row.ma10 ?? 0) || NaN }));
    const ma20 = items.map((row, idx) => ({ time: bars[idx].time, value: toNumber(row.ma20 ?? 0) || NaN }));
    return { bars, volumeBars, ma5, ma10, ma20 };
  }, [period]);

  const applyDataToChart = useCallback((items: KlineRow[]) => {
    if (!seriesRef.current || !chartRef.current) return;
    const { bars, volumeBars, ma5, ma10, ma20 } = buildChartData(items);
    seriesRef.current.setData(bars);
    volumeSeriesRef.current?.setData(volumeBars);
    ma5Ref.current?.setData(ma5);
    ma10Ref.current?.setData(ma10);
    ma20Ref.current?.setData(ma20);
    chartRef.current.timeScale().fitContent();
  }, [buildChartData]);

  // Load more older data
  const loadMore = useCallback((currentData: KlineRow[], currentPeriod: Period, currentCode: string) => {
    if (isLoadingMoreRef.current || hasReachedStartRef.current) return;
    const existing = currentData;
    if (existing.length === 0) return;
    const oldestDate = dateField(existing[0]);
    isLoadingMoreRef.current = true;
    setLoadingMore(true);
    fetchApi<{ items: KlineRow[] }>(`/stocks/${currentCode}/kline?period=${currentPeriod}&before=${oldestDate}`)
      .then((res) => {
        if (!res.items.length) {
          // Backend confirmed there is no older data for this stock+period.
          hasReachedStartRef.current = true;
          return;
        }
        const existingFirstDate = dateField(existing[0]);
        const newItems = res.items.filter((item) => dateField(item) < existingFirstDate);
        if (!newItems.length) {
          hasReachedStartRef.current = true;
          return;
        }
        const merged = [...newItems, ...existing];
        allDataRef.current = merged;
        applyDataToChart(merged);
      })
      .catch(() => { hasReachedStartRef.current = true; })
      .finally(() => { isLoadingMoreRef.current = false; setLoadingMore(false); });
  }, [applyDataToChart]);

  // Chart init
  useEffect(() => {
    if (!containerRef.current) return;
    chartReadyRef.current = false;
    let ro: ResizeObserver | null = null;
    let scrollHandler: ((range: LogicalRange | null) => void) | null = null;

    // Wait for the modal open animation to finish so clientWidth is non-zero.
    const raf = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      import('lightweight-charts').then((lib) => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth || 800;
      const cv = lib.createChart(containerRef.current, {
        layout: { background: { color: '#ffffff' }, textColor: '#333' },
        width: containerWidth,
        height: 360,
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        timeScale: {
          borderColor: '#d9d9d9',
          tickMarkFormatter: (time: number) => {
            const d = new Date(time * 1000);
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          }
        },
        rightPriceScale: { borderColor: '#d9d9d9' },
        localization: {
          locale: 'zh-CN',
          // Override crosshair/tooltip date label to YYYY-MM-DD.
          timeFormatter: (time: number) => {
            const d = new Date(time * 1000);
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          },
          dateFormat: 'yyyy-MM-dd'
        }
      });
      chartRef.current = cv;
      seriesRef.current = cv.addCandlestickSeries({
        upColor: '#cf1322', downColor: '#389e0d',
        borderUpColor: '#cf1322', borderDownColor: '#389e0d',
        wickUpColor: '#cf1322', wickDownColor: '#389e0d'
      });
      const vs = cv.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'volume', color: '#bfbfbf' });
      cv.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volumeSeriesRef.current = vs;
      ma5Ref.current = cv.addLineSeries({ color: '#1677ff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      ma10Ref.current = cv.addLineSeries({ color: '#fa8c16', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      ma20Ref.current = cv.addLineSeries({ color: '#722ed1', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      chartReadyRef.current = true;

      // Apply data if already fetched (handles fetch-arrived-first race)
      if (allDataRef.current.length) {
        applyDataToChart(allDataRef.current);
      }

      ro = new ResizeObserver(() => {
        if (chartRef.current && containerRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current);

      // Subscribe to scroll for lazy loading
      scrollHandler = (range: LogicalRange | null) => {
        if (!range || isLoadingMoreRef.current || hasReachedStartRef.current) return;
        const total = allDataRef.current.length;
        if (total === 0) return;
        // Only trigger when the user has scrolled past the leftmost bar
        // (range.from is negative when the viewport extends into the left margin).
        if (range.from < 0) {
          loadMore(allDataRef.current, period, code);
        }
      };
      cv.timeScale().subscribeVisibleLogicalRangeChange(scrollHandler);

      }).catch((err: Error) => setError(err.message));
    });

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      if (scrollHandler && chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(scrollHandler);
      }
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      ma5Ref.current = null;
      ma10Ref.current = null;
      ma20Ref.current = null;
      chartReadyRef.current = false;
    };
  }, [code, period, applyDataToChart, loadMore]);

  // Fetch data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHasData(false);
    allDataRef.current = [];
    isLoadingMoreRef.current = false;
    hasReachedStartRef.current = false;

    const cached = getCached<{ items: KlineRow[] }>(cacheKey);
    if (cached && Date.now() - cached.timestamp < KLINE_TTL_MS) {
      if (cached.data.items.length) {
        allDataRef.current = cached.data.items;
        setHasData(true);
        if (chartReadyRef.current) applyDataToChart(cached.data.items);
      }
      setLoading(false);
      return;
    }

    fetchApi<{ items: KlineRow[] }>(`/stocks/${code}/kline?period=${period}`)
      .then((data) => {
        if (cancelled) return;
        if (!data.items.length) { setHasData(false); return; }
        allDataRef.current = data.items;
        setHasData(true);
        setCached(cacheKey, data);
        if (chartReadyRef.current) applyDataToChart(data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载K线失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [code, period, cacheKey, getCached, setCached, applyDataToChart]);

  return (
    <Card
      title={<Typography.Text strong>K线（日K）</Typography.Text>}
      extra={
        loadingMore ? (
          <Spin size="small" />
        ) : (
          <Space size="middle" style={{ marginRight: 8 }}>
            <Space size={4} align="center">
              <span style={{ display: 'inline-block', width: 20, height: 2, background: '#1677ff', borderRadius: 1, verticalAlign: 'middle' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: '12px' }}>MA5</Typography.Text>
            </Space>
            <Space size={4} align="center">
              <span style={{ display: 'inline-block', width: 20, height: 2, background: '#fa8c16', borderRadius: 1, verticalAlign: 'middle' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: '12px' }}>MA10</Typography.Text>
            </Space>
            <Space size={4} align="center">
              <span style={{ display: 'inline-block', width: 20, height: 2, background: '#722ed1', borderRadius: 1, verticalAlign: 'middle' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: '12px' }}>MA20</Typography.Text>
            </Space>
          </Space>
        )
      }
    >
      <div style={{ position: 'relative', width: '100%' }}>
        <div ref={containerRef} style={{ width: '100%', height: 360 }} />
        {loading ? (
          <div
            data-testid="kline-loading"
            style={{
              position: 'absolute',
              inset: 0,
              minHeight: 360,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              background: '#ffffff'
            }}
          >
            <Spin size="large" />
            <Typography.Text type="secondary">正在加载 K 线数据…</Typography.Text>
          </div>
        ) : error ? (
          <div style={{ position: 'absolute', inset: 0, minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
            <Empty description={error} />
          </div>
        ) : !hasData ? (
          <div style={{ position: 'absolute', inset: 0, minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
            <Empty description="暂无K线数据" />
          </div>
        ) : null}
      </div>
    
    </Card>
  );
}
