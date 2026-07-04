import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function randomGauss(mean: number, std: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function calcMA(values: (number | null)[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1 || values[i] == null) {
      result.push(null);
    } else {
      const windowVals = values.slice(i - window + 1, i + 1).filter((v): v is number => v != null);
      if (windowVals.length < window) {
        result.push(null);
      } else {
        result.push(windowVals.reduce((a, b) => a + b, 0) / window);
      }
    }
  }
  return result;
}

async function seedKline() {
  // Get all stocks
  const stocks = await prisma.stock.findMany({ select: { code: true } });
  console.log(`Found ${stocks.length} stocks`);

  // Get base prices from Quote table
  const quotes = await prisma.quote.findMany();
  const priceMap = new Map(quotes.map(q => [q.code, Number(q.currentPrice)]));

  // Generate 365 days ending yesterday
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - 1);

  // Build list of trading dates (skip weekends)
  const tradingDates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      tradingDates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  for (const stock of stocks) {
    const code = stock.code;
    const basePrice = priceMap.get(code) || (100 + Math.random() * 400);

    // Generate OHLCV data
    const closes: number[] = [];
    const opens: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    let price = basePrice * (0.85 + Math.random() * 0.3);

    for (let i = 0; i < tradingDates.length; i++) {
      const dailyReturn = randomGauss(0.001, 0.02);
      const openPrice = price * (1 + randomGauss(0, 0.005));
      const closePrice = openPrice * (1 + dailyReturn);
      const highPrice = Math.max(openPrice, closePrice) * (1 + Math.abs(randomGauss(0, 0.01)));
      const lowPrice = Math.min(openPrice, closePrice) * (1 - Math.abs(randomGauss(0, 0.01)));
      const volume = Math.max(100000, Math.floor(randomGauss(5_000_000, 2_000_000) * (1 + Math.abs(dailyReturn) * 10)));

      opens.push(Number(openPrice.toFixed(2)));
      closes.push(Number(closePrice.toFixed(2)));
      highs.push(Number(highPrice.toFixed(2)));
      lows.push(Number(lowPrice.toFixed(2)));
      volumes.push(volume);
      price = closePrice;
    }

    const ma5 = calcMA(closes, 5);
    const ma10 = calcMA(closes, 10);
    const ma20 = calcMA(closes, 20);

    // Insert daily K-line
    for (let i = 0; i < tradingDates.length; i++) {
      const tradeDateStr = tradingDates[i].toISOString().split('T')[0];
      const tradeDate = new Date(tradeDateStr + 'T00:00:00.000Z');
      await prisma.klineDaily.upsert({
        where: { code_tradeDate: { code, tradeDate } },
        create: {
          code,
          tradeDate,
          open: new Prisma.Decimal(opens[i].toString()),
          high: new Prisma.Decimal(highs[i].toString()),
          low: new Prisma.Decimal(lows[i].toString()),
          close: new Prisma.Decimal(closes[i].toString()),
          volume: new Prisma.Decimal(volumes[i].toString()),
          ma5: ma5[i] != null ? new Prisma.Decimal(ma5[i]!.toFixed(2)) : null,
          ma10: ma10[i] != null ? new Prisma.Decimal(ma10[i]!.toFixed(2)) : null,
          ma20: ma20[i] != null ? new Prisma.Decimal(ma20[i]!.toFixed(2)) : null,
        },
        update: {
          open: new Prisma.Decimal(opens[i].toString()),
          high: new Prisma.Decimal(highs[i].toString()),
          low: new Prisma.Decimal(lows[i].toString()),
          close: new Prisma.Decimal(closes[i].toString()),
          volume: new Prisma.Decimal(volumes[i].toString()),
          ma5: ma5[i] != null ? new Prisma.Decimal(ma5[i]!.toFixed(2)) : null,
          ma10: ma10[i] != null ? new Prisma.Decimal(ma10[i]!.toFixed(2)) : null,
          ma20: ma20[i] != null ? new Prisma.Decimal(ma20[i]!.toFixed(2)) : null,
        },
      });
    }

    // Resample to weekly
    const weeklyMap = new Map<string, { opens: number[]; highs: number[]; lows: number[]; closes: number[]; volumes: number[] }>();
    for (let i = 0; i < tradingDates.length; i++) {
      const d = tradingDates[i];
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { opens: [], highs: [], lows: [], closes: [], volumes: [] });
      }
      const w = weeklyMap.get(weekKey)!;
      w.opens.push(opens[i]);
      w.highs.push(highs[i]);
      w.lows.push(lows[i]);
      w.closes.push(closes[i]);
      w.volumes.push(volumes[i]);
    }

    const weeklyDates = Array.from(weeklyMap.keys()).sort();
    const weeklyCloses = weeklyDates.map(w => weeklyMap.get(w)!.closes[weeklyMap.get(w)!.closes.length - 1]);
    const weeklyMA5 = calcMA(weeklyCloses, 5);
    const weeklyMA10 = calcMA(weeklyCloses, 10);
    const weeklyMA20 = calcMA(weeklyCloses, 20);

    for (let i = 0; i < weeklyDates.length; i++) {
      const w = weeklyMap.get(weeklyDates[i])!;
      const weekDate = new Date(weeklyDates[i] + 'T00:00:00.000Z');
      await prisma.klineWeekly.upsert({
        where: { code_weekDate: { code, weekDate } },
        create: {
          code,
          weekDate,
          open: new Prisma.Decimal(w.opens[0].toString()),
          high: new Prisma.Decimal(Math.max(...w.highs).toString()),
          low: new Prisma.Decimal(Math.min(...w.lows).toString()),
          close: new Prisma.Decimal(w.closes[w.closes.length - 1].toString()),
          volume: new Prisma.Decimal(w.volumes.reduce((a, b) => a + b, 0).toString()),
          ma5: weeklyMA5[i] != null ? new Prisma.Decimal(weeklyMA5[i]!.toFixed(2)) : null,
          ma10: weeklyMA10[i] != null ? new Prisma.Decimal(weeklyMA10[i]!.toFixed(2)) : null,
          ma20: weeklyMA20[i] != null ? new Prisma.Decimal(weeklyMA20[i]!.toFixed(2)) : null,
        },
        update: {
          open: new Prisma.Decimal(w.opens[0].toString()),
          high: new Prisma.Decimal(Math.max(...w.highs).toString()),
          low: new Prisma.Decimal(Math.min(...w.lows).toString()),
          close: new Prisma.Decimal(w.closes[w.closes.length - 1].toString()),
          volume: new Prisma.Decimal(w.volumes.reduce((a, b) => a + b, 0).toString()),
          ma5: weeklyMA5[i] != null ? new Prisma.Decimal(weeklyMA5[i]!.toFixed(2)) : null,
          ma10: weeklyMA10[i] != null ? new Prisma.Decimal(weeklyMA10[i]!.toFixed(2)) : null,
          ma20: weeklyMA20[i] != null ? new Prisma.Decimal(weeklyMA20[i]!.toFixed(2)) : null,
        },
      });
    }

    // Resample to monthly
    const monthlyMap = new Map<string, { opens: number[]; highs: number[]; lows: number[]; closes: number[]; volumes: number[] }>();
    for (let i = 0; i < tradingDates.length; i++) {
      const d = tradingDates[i];
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { opens: [], highs: [], lows: [], closes: [], volumes: [] });
      }
      const m = monthlyMap.get(monthKey)!;
      m.opens.push(opens[i]);
      m.highs.push(highs[i]);
      m.lows.push(lows[i]);
      m.closes.push(closes[i]);
      m.volumes.push(volumes[i]);
    }

    const monthlyDates = Array.from(monthlyMap.keys()).sort();
    const monthlyCloses = monthlyDates.map(m => monthlyMap.get(m)!.closes[monthlyMap.get(m)!.closes.length - 1]);
    const monthlyMA5 = calcMA(monthlyCloses, 5);
    const monthlyMA10 = calcMA(monthlyCloses, 10);
    const monthlyMA20 = calcMA(monthlyCloses, 20);

    for (let i = 0; i < monthlyDates.length; i++) {
      const m = monthlyMap.get(monthlyDates[i])!;
      const monthDate = new Date(monthlyDates[i] + 'T00:00:00.000Z');
      await prisma.klineMonthly.upsert({
        where: { code_monthDate: { code, monthDate } },
        create: {
          code,
          monthDate,
          open: new Prisma.Decimal(m.opens[0].toString()),
          high: new Prisma.Decimal(Math.max(...m.highs).toString()),
          low: new Prisma.Decimal(Math.min(...m.lows).toString()),
          close: new Prisma.Decimal(m.closes[m.closes.length - 1].toString()),
          volume: new Prisma.Decimal(m.volumes.reduce((a, b) => a + b, 0).toString()),
          ma5: monthlyMA5[i] != null ? new Prisma.Decimal(monthlyMA5[i]!.toFixed(2)) : null,
          ma10: monthlyMA10[i] != null ? new Prisma.Decimal(monthlyMA10[i]!.toFixed(2)) : null,
          ma20: monthlyMA20[i] != null ? new Prisma.Decimal(monthlyMA20[i]!.toFixed(2)) : null,
        },
        update: {
          open: new Prisma.Decimal(m.opens[0].toString()),
          high: new Prisma.Decimal(Math.max(...m.highs).toString()),
          low: new Prisma.Decimal(Math.min(...m.lows).toString()),
          close: new Prisma.Decimal(m.closes[m.closes.length - 1].toString()),
          volume: new Prisma.Decimal(m.volumes.reduce((a, b) => a + b, 0).toString()),
          ma5: monthlyMA5[i] != null ? new Prisma.Decimal(monthlyMA5[i]!.toFixed(2)) : null,
          ma10: monthlyMA10[i] != null ? new Prisma.Decimal(monthlyMA10[i]!.toFixed(2)) : null,
          ma20: monthlyMA20[i] != null ? new Prisma.Decimal(monthlyMA20[i]!.toFixed(2)) : null,
        },
      });
    }

    console.log(`  ${code}: ${tradingDates.length} daily, ${weeklyDates.length} weekly, ${monthlyDates.length} monthly`);
  }

  console.log('Done!');
}

seedKline().catch(console.error).finally(() => prisma.$disconnect());
