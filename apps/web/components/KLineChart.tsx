'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Empty, Radio, Space, Spin, Typography } from 'antd';
import type { IChartApi, UTCTimestamp } from 'lightweight-charts';
import type { KlineRow } from '@stock-assistant/shared';
import { fetchApi } from '../lib/api';

type Period = 'daily' | 'weekly' | 'monthly';

export function KLineChart({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [period, setPeriod] = useState<Period>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let chart: IChartApi | undefined;
    let observer: ResizeObserver | undefined;
    setLoading(true);
    setError(null);
    setHasData(false);

    async function load() {
      const [lib, data] = await Promise.all([
        import('lightweight-charts'),
        fetchApi<{ items: KlineRow[] }>(`/stocks/${encodeURIComponent(code)}/kline?period=${period}`)
      ]);
      if (cancelled || !container) return;
      const byTime = new Map<number, KlineRow>();
      for (const row of data.items) {
        const date = period === 'weekly' ? row.weekDate : period === 'monthly' ? row.monthDate : row.tradeDate;
        const time = Math.floor(new Date(date ?? '').getTime() / 1000);
        if (!Number.isFinite(time) || ![row.open, row.high, row.low, row.close].every(value => Number.isFinite(Number(value)))) {
          throw new Error('K线数据日期或价格无效');
        }
        byTime.set(time, row);
      }
      const rows = [...byTime.entries()].sort(([a], [b]) => a - b);
      if (!rows.length) return;
      chart = lib.createChart(container, {
        width: container.clientWidth, height: 360,
        layout: { background: { color: '#ffffff' }, textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } }
      });
      const candle = chart.addCandlestickSeries({
        upColor: '#cf1322', downColor: '#389e0d', borderUpColor: '#cf1322',
        borderDownColor: '#389e0d', wickUpColor: '#cf1322', wickDownColor: '#389e0d'
      });
      candle.setData(rows.map(([time, row]) => ({
        time: time as UTCTimestamp, open: Number(row.open), high: Number(row.high),
        low: Number(row.low), close: Number(row.close)
      })));
      const volume = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volume.setData(rows.map(([time, row]) => ({
        time: time as UTCTimestamp, value: Number(row.volume ?? 0),
        color: Number(row.close) >= Number(row.open) ? '#cf1322' : '#389e0d'
      })));
      for (const [field, color] of [['ma5', '#1677ff'], ['ma10', '#fa8c16'], ['ma20', '#722ed1']] as const) {
        const line = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        line.setData(rows.map(([time, row]) => {
          const value = row[field] == null ? null : Number(row[field]);
          return value != null && Number.isFinite(value)
            ? { time: time as UTCTimestamp, value }
            : { time: time as UTCTimestamp };
        }));
      }
      observer = new ResizeObserver(() => chart?.applyOptions({ width: container.clientWidth }));
      observer.observe(container);
      chart.timeScale().fitContent();
      setHasData(true);
    }

    load().catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : '加载K线失败');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      chart?.remove();
    };
  }, [code, period]);

  return (
    <Card title={
      <Space>
        <Typography.Text strong>K线</Typography.Text>
        <Radio.Group size="small" value={period} onChange={event => setPeriod(event.target.value as Period)} optionType="button" buttonStyle="solid">
          <Radio.Button value="daily">日K</Radio.Button>
          <Radio.Button value="weekly">周K</Radio.Button>
          <Radio.Button value="monthly">月K</Radio.Button>
        </Radio.Group>
      </Space>
    }>
      <Spin spinning={loading}>
        <div ref={containerRef} style={{ width: '100%', height: 360, display: 'block' }} />
        {!loading && (!hasData || error) && <Empty description={error ?? '暂无K线数据'} />}
      </Spin>
    </Card>
  );
}
