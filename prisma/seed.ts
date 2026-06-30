import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tradeDate = new Date('2026-06-30T00:00:00.000Z');

async function main() {
  const stocks = [
    { code: '600519', name: '贵州茅台', market: 'A股', industry: '食品饮料', sector: '白酒', assetType: 'stock' as const },
    { code: '300750', name: '宁德时代', market: 'A股', industry: '电力设备', sector: '锂电池', assetType: 'stock' as const },
    { code: '600036', name: '招商银行', market: 'A股', industry: '银行', sector: '股份制银行', assetType: 'stock' as const },
    { code: '510300', name: '沪深300ETF', market: 'A股', industry: 'ETF', sector: '宽基指数', assetType: 'etf' as const },
    { code: '510500', name: '中证500ETF', market: 'A股', industry: 'ETF', sector: '宽基指数', assetType: 'etf' as const }
  ];

  for (const stock of stocks) {
    await prisma.stock.upsert({
      where: { code: stock.code },
      create: stock,
      update: stock
    });
  }

  const holdings = [
    { code: '600519', name: '贵州茅台', assetType: 'stock' as const, quantity: 10, averageCost: 1600, tags: '核心观察', note: '示例数据，仅用于演示' },
    { code: '300750', name: '宁德时代', assetType: 'stock' as const, quantity: 100, averageCost: 180, tags: '新能源', note: '示例数据，仅用于演示' },
    { code: '510300', name: '沪深300ETF', assetType: 'etf' as const, quantity: 1000, averageCost: 3.7, tags: '宽基ETF', note: '示例数据，仅用于演示' }
  ];

  await prisma.holding.deleteMany();
  await prisma.holding.createMany({ data: holdings });

  const quotes = [
    { code: '600519', currentPrice: 1680.5, preClose: 1660, changeAmount: 20.5, changePercent: 1.23, volume: 3200000, turnover: 5360000000, turnoverRate: 0.26 },
    { code: '300750', currentPrice: 185.2, preClose: 188.1, changeAmount: -2.9, changePercent: -1.54, volume: 24500000, turnover: 4540000000, turnoverRate: 0.63 },
    { code: '600036', currentPrice: 35.6, preClose: 35.1, changeAmount: 0.5, changePercent: 1.42, volume: 68000000, turnover: 2410000000, turnoverRate: 0.33 },
    { code: '510300', currentPrice: 3.88, preClose: 3.85, changeAmount: 0.03, changePercent: 0.78, volume: 880000000, turnover: 3410000000, turnoverRate: 0.0 },
    { code: '510500', currentPrice: 5.42, preClose: 5.48, changeAmount: -0.06, changePercent: -1.09, volume: 210000000, turnover: 1140000000, turnoverRate: 0.0 }
  ];

  for (const quote of quotes) {
    await prisma.quote.upsert({
      where: { code_tradeDate: { code: quote.code, tradeDate } },
      create: { ...quote, tradeDate },
      update: quote
    });
  }

  const watchlist = [
    { code: '600519', name: '贵州茅台', sortOrder: 1, note: '示例自选' },
    { code: '300750', name: '宁德时代', sortOrder: 2, note: '示例自选' },
    { code: '600036', name: '招商银行', sortOrder: 3, note: '示例自选' },
    { code: '510500', name: '中证500ETF', sortOrder: 4, note: '示例自选' }
  ];

  for (const item of watchlist) {
    await prisma.watchlistItem.upsert({
      where: { code: item.code },
      create: item,
      update: item
    });
  }

  await prisma.setting.upsert({
    where: { key: 'claude.defaultModel' },
    create: { key: 'claude.defaultModel', value: 'claude-sonnet-4-6' },
    update: { value: 'claude-sonnet-4-6' }
  });

  await prisma.setting.upsert({
    where: { key: 'claude.deepModel' },
    create: { key: 'claude.deepModel', value: 'claude-opus-4-7' },
    update: { value: 'claude-opus-4-7' }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
