'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Empty, Radio, Space, Spin, Typography } from 'antd';
import type { IChartApi, ISeriesApi, Time, UTCTimestamp } from 'lightweight-charts';
import { fetchApi } from '../lib/api';

type Period = 'daily' | 'weekly' | 'monthly';

interface KlineRow {
  tradeDate?: string;
  weekDate?: string;
  monthDate?: string;
  time?: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume?: number | string | null;
  ma5?: number | string | null;
  ma10?: number | string | null;
  ma20?: number | string | null;
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value);
}

function dateField(row: KlineRow, period: Period): string {
  if (period === 'weekly') return row.weekDate ?? '';
  if (period === 'monthly') return row.monthDate ?? '';
  return row.tradeDate ?? '';
}

interface BarInput {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function KLineChart({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma10Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);

  const [period, setPeriod] = useState<Period>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let chart: IChartApi | null = null;
    let cancelled = false;

    (async () => {
      const lib = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;
      chart = lib.createChart(containerRef.current, {
        layout: { background: { color: '#ffffff' }, textColor: '#333' },
        width: containerRef.current.clientWidth,
        height: 360,
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        timeScale: { borderColor: '#d9d9d9' },
        rightPriceScale: { borderColor: '#d9d9d9' }
      });
      chartRef.current = chart;

      const candle = chart.addCandlestickSeries({
        upColor: '#cf1322',
        downColor: '#389e0d',
        borderUpColor: '#cf1322',
        borderDownColor: '#389e0d',
        wickUpColor: '#cf1322',
        wickDownColor: '#389e0d'
      });
      seriesRef.current = candle;

      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        color: '#bfbfbf'
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 }
      });
      volumeSeriesRef.current = volumeSeries;

      const ma5 = chart.addLineSeries({ color: '#1677ff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ma10 = chart.addLineSeries({ color: '#fa8c16', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ma20 = chart.addLineSeries({ color: '#722ed1', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      ma5Ref.current = ma5;
      ma10Ref.current = ma10;
      ma20Ref.current = ma20;

      const resize = () => {
        if (chartRef.current && containerRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', resize);

      return () => {
        window.removeEventListener('resize', resize);
      };
    })().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : '图表初始化失败');
    });

    return () => {
      cancelled = true;
      if (chart) chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      ma5Ref.current = null;
      ma10Ref.current = null;
      ma20Ref.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchApi<{ items: KlineRow[] }>(`/stocks/${code}/kline?period=${period}`)
      .then((data) => {
        if (cancelled) return;
        const items = data.items;
        if (!items.length) {
          setHasData(false);
          return;
        }
        setHasData(true);

        const bars: BarInput[] = items.map((row) => {
          const dateStr = dateField(row, period);
          const ts = Math.floor(new Date(dateStr).getTime() / 1000) as UTCTimestamp;
          return {
            time: ts as Time,
            open: toNumber(row.open),
            high: toNumber(row.high),
            low: toNumber(row.low),
            close: toNumber(row.close)
          };
        });
        const volumeBars = items.map((row, idx) => ({
          time: bars[idx].time,
          value: toNumber(row.volume ?? 0),
          color: toNumber(row.close) >= toNumber(row.open) ? '#cf1322' : '#389e0d'
        }));
        const ma5 = items.map((row, idx) => ({ time: bars[idx].time, value: toNumber(row.ma5 ?? 0) || NaN }));
        const ma10 = items.map((row, idx) => ({ time: bars[idx].time, value: toNumber(row.ma10 ?? 0) || NaN }));
        const ma20 = items.map((row, idx) => ({ time: bars[idx].time, value: toNumber(row.ma20 ?? 0) || NaN }));

        seriesRef.current?.setData(bars);
        volumeSeriesRef.current?.setData(volumeBars);
        ma5Ref.current?.setData(ma5);
        ma10Ref.current?.setData(ma10);
        ma20Ref.current?.setData(ma20);
        chartRef.current?.timeScale().fitContent();
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载K线失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, period]);

  return (
    <Card
      title={
        <Space>
          <Typography.Text strong>K线</Typography.Text>
          <Radio.Group
            size="small"
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="daily">日K</Radio.Button>
            <Radio.Button value="weekly">周K</Radio.Button>
            <Radio.Button value="monthly">月K</Radio.Button>
          </Radio.Group>
        </Space>
      }
    >
      {loading ? (
        <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      ) : error ? (
        <Empty description={error} />
      ) : !hasData ? (
        <Empty description="暂无K线数据，运行行情 worker 后将自动填充" />
      ) : (
        <div ref={containerRef} style={{ width: '100%' }} />
      )}
    </Card>
  );
}
