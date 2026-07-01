import { prisma } from '../plugins/prisma';
import { execSync } from 'child_process';
import { resolve } from 'path';

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toNumberOrNull(value: unknown) {
  return value == null ? null : Number(value);
}

function lookupStockFromAkShare(code: string): { name: string | null; assetType: 'stock' | 'etf' } {
  try {
    const scriptsDir = resolve(__dirname, '..', '..', '..', '..', 'worker', 'scripts');
    const result = execSync(`python3 "${scriptsDir}/lookup_stock.py" "${code}"`, {
      timeout: 15000,
      encoding: 'utf-8'
    });
    const data = JSON.parse(result) as { ok: boolean; name?: string; error?: string };
    if (!data.ok) return { name: null, assetType: 'stock' };
    return { name: data.name ?? null, assetType: 'stock' };
  } catch {
    return { name: null, assetType: 'stock' };
  }
}

export async function getHoldings() {
  const holdings = await prisma.holding.findMany({
    orderBy: { id: 'asc' },
    include: {
      stock: {
        include: {
          quotes: {
            orderBy: { tradeDate: 'desc' },
            take: 1
          }
        }
      }
    }
  });

  const rawRows = holdings.map((holding) => {
    const quote = holding.stock.quotes[0];
    const quantity = toNumber(holding.quantity);
    const averageCost = toNumber(holding.averageCost);
    const currentPrice = toNumber(quote?.currentPrice);
    const changeAmount = toNumber(quote?.changeAmount);
    const changePercent = toNumber(quote?.changePercent);
    const marketValue = currentPrice * quantity;
    const costAmount = averageCost * quantity;
    const todayProfit = changeAmount * quantity;
    const totalProfit = marketValue - costAmount;
    const yesterdayValue = toNumber(quote?.preClose) * quantity;

    return {
      id: holding.id,
      code: holding.code,
      name: holding.name,
      assetType: holding.assetType,
      quantity,
      averageCost,
      currentPrice,
      changeAmount,
      changePercent,
      marketValue,
      costAmount,
      todayProfit,
      todayProfitRate: yesterdayValue > 0 ? todayProfit / yesterdayValue : 0,
      totalProfit,
      totalProfitRate: costAmount > 0 ? totalProfit / costAmount : 0,
      tags: holding.tags,
      note: holding.note
    };
  });

  const totalMarketValue = rawRows.reduce((sum, row) => sum + row.marketValue, 0);

  return {
    items: rawRows.map(({ costAmount, ...row }) => ({
      ...row,
      weight: totalMarketValue > 0 ? row.marketValue / totalMarketValue : 0
    }))
  };
}

export interface HoldingInput {
  code: string;
  quantity: number;
  averageCost: number;
  assetType: 'stock' | 'etf';
  buyDate?: string | null;
  tags?: string | null;
  note?: string | null;
}

async function ensureStock(code: string, name: string, assetType: 'stock' | 'etf') {
  return prisma.stock.upsert({
    where: { code },
    create: { code, name, assetType, market: 'A股' },
    update: {}
  });
}

export async function createHolding(input: HoldingInput) {
  const stock = await prisma.stock.findUnique({ where: { code: input.code } });
  let name: string | null | undefined = stock?.name;
  let assetType = (stock?.assetType as 'stock' | 'etf') ?? input.assetType;

  if (!name) {
    const looked = lookupStockFromAkShare(input.code);
    name = looked.name;
    assetType = looked.assetType;
  }
  name = name || input.code;

  await ensureStock(input.code, name, assetType);

  const holding = await prisma.holding.create({
    data: {
      code: input.code,
      name,
      assetType,
      quantity: input.quantity,
      averageCost: input.averageCost,
      buyDate: input.buyDate ? new Date(input.buyDate) : null,
      tags: input.tags ?? null,
      note: input.note ?? null
    }
  });

  return { id: holding.id };
}

export async function updateHolding(id: number, input: Partial<HoldingInput>) {
  const existing = await prisma.holding.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  const data: Record<string, unknown> = {};
  if (input.quantity != null) data.quantity = input.quantity;
  if (input.averageCost != null) data.averageCost = input.averageCost;
  if (input.buyDate !== undefined) data.buyDate = input.buyDate ? new Date(input.buyDate) : null;
  if (input.tags !== undefined) data.tags = input.tags ?? null;
  if (input.note !== undefined) data.note = input.note ?? null;

  await prisma.holding.update({ where: { id }, data });
  return { id };
}

export async function deleteHolding(id: number) {
  const existing = await prisma.holding.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  await prisma.holding.delete({ where: { id } });
  return { id };
}

export async function getHoldingById(id: number) {
  const holding = await prisma.holding.findUnique({
    where: { id },
    include: {
      stock: {
        include: {
          quotes: { orderBy: { tradeDate: 'desc' }, take: 1 }
        }
      }
    }
  });

  if (!holding) return null;

  const quote = holding.stock.quotes[0];
  return {
    id: holding.id,
    code: holding.code,
    name: holding.name,
    assetType: holding.assetType,
    quantity: toNumber(holding.quantity),
    averageCost: toNumber(holding.averageCost),
    buyDate: holding.buyDate?.toISOString().slice(0, 10) ?? null,
    tags: holding.tags,
    note: holding.note,
    currentPrice: toNumberOrNull(quote?.currentPrice),
    changePercent: toNumberOrNull(quote?.changePercent)
  };
}
