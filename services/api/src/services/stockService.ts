import { prisma } from '../plugins/prisma';

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toNumberOrNull(value: unknown) {
  return value == null ? null : Number(value);
}

export async function getStockDetail(code: string) {
  return prisma.stock.findUnique({ where: { code } });
}

export async function getStockQuote(code: string) {
  return prisma.quote.findFirst({
    where: { code },
    orderBy: { tradeDate: 'desc' }
  });
}

export async function getStockKline(code: string, period: string) {
  if (period === 'weekly') {
    return { items: await prisma.klineWeekly.findMany({ where: { code }, orderBy: { weekDate: 'asc' } }) };
  }

  if (period === 'monthly') {
    return { items: await prisma.klineMonthly.findMany({ where: { code }, orderBy: { monthDate: 'asc' } }) };
  }

  if (period === 'intraday') {
    return { items: await prisma.intradayQuote.findMany({ where: { code }, orderBy: [{ tradeDate: 'asc' }, { time: 'asc' }] }) };
  }

  return { items: await prisma.klineDaily.findMany({ where: { code }, orderBy: { tradeDate: 'asc' } }) };
}

export async function getStockNews(code: string) {
  return {
    items: await prisma.newsItem.findMany({
      where: { code },
      orderBy: { publishDate: 'desc' }
    })
  };
}

interface KlineRow {
  tradeDate: Date;
  close: unknown;
  high: unknown;
  low: unknown;
  open: unknown;
  volume: unknown;
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
      sum += toNumber(rows[j].close);
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
  const close = toNumber(daily[last].close);
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

  // 连续涨跌天数
  let streak = 0;
  let direction: 'up' | 'down' | null = null;
  for (let i = daily.length - 1; i > 0; i -= 1) {
    const today = toNumber(daily[i].close);
    const yesterday = toNumber(daily[i - 1].close);
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

  // 量能：最近 5 日均量 vs 前 20 日均量
  if (daily.length >= 25) {
    const recent5 = daily.slice(-5).reduce((sum, row) => sum + toNumber(row.volume), 0) / 5;
    const prior20 = daily.slice(-25, -5).reduce((sum, row) => sum + toNumber(row.volume), 0) / 20;
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

export async function getStockFundFlow(code: string) {
  return {
    items: await prisma.fundFlow.findMany({
      where: { code, level: 'stock' },
      orderBy: { flowDate: 'desc' },
      take: 30
    })
  };
}
