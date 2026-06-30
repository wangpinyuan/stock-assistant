import { prisma } from '../plugins/prisma';

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
