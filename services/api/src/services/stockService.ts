import { prisma } from '../plugins/prisma';
import { toNumber, toNumberOrNull } from '@stock-assistant/shared';
import type { KlineRow } from '@stock-assistant/shared';

export async function getStockDetail(code: string) {
  return prisma.stock.findUnique({ where: { code } });
}

export async function getStockQuote(code: string) {
  return prisma.quote.findFirst({
    where: { code },
    orderBy: { tradeDate: 'desc' }
  });
}

type SinaBar = {
  day: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
};

async function fetchDailyFromSina(code: string): Promise<SinaBar[]> {
  const market = code.startsWith('5') || code.startsWith('6') || code.startsWith('9') ? 'sh' : 'sz';
  const url = `http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${market}${code}&scale=240&ma=no&datalen=2500`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`sina returned ${resp.status}`);
  const raw = await resp.text();
  const data = JSON.parse(raw) as SinaBar[] | null;
  return Array.isArray(data) ? data : [];
}



function barsToKlineRows(period: string, bars: SinaBar[]): KlineRow[] {
  const closes = bars.map((b) => Number(b.close));
  const ma5 = movingAverageFromCloses(closes, 5);
  const ma10 = movingAverageFromCloses(closes, 10);
  const ma20 = movingAverageFromCloses(closes, 20);
  return bars.map((b, i) => {
    const date = String(b.day).slice(0, 10);
    const row: KlineRow = {
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
      volume: Number(b.volume),
      ma5: ma5[i] ?? null,
      ma10: ma10[i] ?? null,
      ma20: ma20[i] ?? null
    };
    if (period === 'weekly') row.weekDate = date;
    else if (period === 'monthly') row.monthDate = date;
    else row.tradeDate = date;
    return row;
  });
}

function movingAverageFromCloses(closes: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < window - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += closes[j];
    result.push(sum / window);
  }
  return result;
}

export async function getStockKline(code: string, period: string, before?: string) {
  // Realtime: always hit Sina on every request. Only daily is supported;
  // weekly/monthly return empty so the chart shows no data for those tabs.
  if (period !== 'daily') {
    return { items: [] };
  }

  try {
    let bars = await fetchDailyFromSina(code);
    if (before) {
      bars = bars.filter((b) => String(b.day).slice(0, 10) < before);
    }
    const items = barsToKlineRows(period, bars);
    return { items };
  } catch (err) {
    console.warn('[kline] realtime fetch failed', code, err instanceof Error ? err.message : err);
    return { items: [] };
  }
}



function movingAverage(rows: KlineRow[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (i < window - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j += 1) {
      sum += toNumber(rows[j].close as number | string);
    }
    result.push(sum / window);
  }
  return result;
}

export async function getStockAnalysisSignals(code: string) {
  const daily = (await prisma.klineDaily.findMany({
    where: { code },
    orderBy: { tradeDate: 'asc' }
  })) as unknown as KlineRow[];

  if (daily.length < 5) {
    return { signals: [] };
  }

  const ma5 = movingAverage(daily, 5);
  const ma10 = movingAverage(daily, 10);
  const ma20 = movingAverage(daily, 20);

  const last = daily.length - 1;
  const close = toNumber(daily[last].close as number | string);
  const lastMa5 = ma5[last];
  const lastMa10 = ma10[last];
  const lastMa20 = ma20[last];

  const signals: Array<{ key: string; label: string; tone: 'bull' | 'bear' | 'neutral'; detail: string }> = [];

  if (lastMa5 != null && lastMa10 != null && lastMa20 != null) {
    if (lastMa5 > lastMa10 && lastMa10 > lastMa20) {
      signals.push({ key: 'ma-bull', label: '均线多头排列', tone: 'bull', detail: 'MA5 > MA10 > MA20' });
    } else if (lastMa5 < lastMa10 && lastMa10 < lastMa20) {
      signals.push({ key: 'ma-bear', label: '均线空头排列', tone: 'bear', detail: 'MA5 < MA10 < MA20' });
    }
  }

  if (lastMa20 != null) {
    const diff = (close - lastMa20) / lastMa20;
    if (diff > 0.02) {
      signals.push({ key: 'above-ma20', label: '站上 MA20', tone: 'bull', detail: `偏离 +${(diff * 100).toFixed(2)}%` });
    } else if (diff < -0.02) {
      signals.push({ key: 'below-ma20', label: '跌破 MA20', tone: 'bear', detail: `偏离 ${(diff * 100).toFixed(2)}%` });
    }
  }

  let streak = 0;
  let direction: 'up' | 'down' | null = null;
  for (let i = daily.length - 1; i > 0; i -= 1) {
    const today = toNumber(daily[i].close as number | string);
    const yesterday = toNumber(daily[i - 1].close as number | string);
    if (today > yesterday) {
      if (direction === 'down') break;
      direction = 'up';
      streak += 1;
    } else if (today < yesterday) {
      if (direction === 'up') break;
      direction = 'down';
      streak += 1;
    } else {
      break;
    }
  }
  if (streak >= 3) {
    signals.push({
      key: 'streak',
      label: direction === 'up' ? `连涨 ${streak} 日` : `连跌 ${streak} 日`,
      tone: direction === 'up' ? 'bull' : 'bear',
      detail: '基于日线收盘价'
    });
  }

  if (daily.length >= 25) {
    const recent5 = daily.slice(-5).reduce((sum, row) => sum + toNumber(row.volume as number | string), 0) / 5;
    const prior20 = daily.slice(-25, -5).reduce((sum, row) => sum + toNumber(row.volume as number | string), 0) / 20;
    if (prior20 > 0) {
      const ratio = recent5 / prior20;
      if (ratio >= 1.5) {
        signals.push({ key: 'volume-up', label: '近期放量', tone: 'bull', detail: `5 日均量 / 20 日均量 = ${ratio.toFixed(2)}` });
      } else if (ratio <= 0.6) {
        signals.push({ key: 'volume-down', label: '近期缩量', tone: 'bear', detail: `5 日均量 / 20 日均量 = ${ratio.toFixed(2)}` });
      }
    }
  }

  return {
    signals,
    summary: {
      ma5: toNumberOrNull(lastMa5),
      ma10: toNumberOrNull(lastMa10),
      ma20: toNumberOrNull(lastMa20),
      lastClose: close
    }
  };
}
