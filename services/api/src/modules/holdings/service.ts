import type { HoldingInput } from '@stock-assistant/shared';
import { prisma } from '../../infrastructure/prisma';
import { toNumber, toNumberOrNull } from '@stock-assistant/shared';
import { loadValuedHoldings } from './valuation';
import { lookupSecurity, ensureStock } from '../stocks/catalog';

export async function getHoldings() {
  const rows = await loadValuedHoldings();
  const complete = rows.every(row => row.valuation.marketValue != null);
  const totalMarketValue = rows.reduce((sum, row) => sum + (row.valuation.marketValue ?? 0), 0);
  return {
    items: rows.map(({ holding, valuation, tradeDate }) => {
      const { costAmount, yesterdayValue, ...values } = valuation;
      return {
        id: holding.id, code: holding.code, name: holding.stock.name,
        assetType: holding.stock.assetType, ...values,
        weight: complete && totalMarketValue > 0 && values.marketValue != null ? values.marketValue / totalMarketValue : null,
        buyDate: holding.buyDate?.toISOString().slice(0, 10) ?? null,
        quoteTradeDate: tradeDate?.toISOString().slice(0, 10) ?? null,
        tags: holding.tags, note: holding.note
      };
    })
  };
}


export async function createHolding(input: HoldingInput) {
  const stock = await prisma.stock.findUnique({ where: { code: input.code } });
  let name: string | null | undefined = stock?.name && stock.name !== input.code ? stock.name : input.name?.trim();
  const assetType = input.assetType ?? (stock?.assetType === 'etf' ? 'etf' : 'stock');

  if (!name) {
    const looked = await lookupSecurity(input.code);
    name = looked.name;
  }
  name = name || input.code;

  const holding = await prisma.$transaction(async db => {
    const canonical = await ensureStock(input.code, name, assetType, db);
    await db.stock.update({ where: { code: input.code }, data: { assetType } });
    return db.holding.create({
      data: {
        code: input.code,
        name: canonical.name,
        assetType,
        quantity: input.quantity,
        averageCost: input.averageCost,
        buyDate: input.buyDate ? new Date(input.buyDate) : null,
        tags: input.tags ?? null,
        note: input.note ?? null
      }
    });
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
    name: holding.stock.name,
    assetType: holding.stock.assetType,
    quantity: toNumber(holding.quantity),
    averageCost: toNumber(holding.averageCost),
    buyDate: holding.buyDate?.toISOString().slice(0, 10) ?? null,
    tags: holding.tags,
    note: holding.note,
    currentPrice: toNumberOrNull(quote?.currentPrice),
    changePercent: toNumberOrNull(quote?.changePercent)
  };
}
