import type { Prisma } from '@prisma/client';
import { isValidStockCode, type AssetType } from '@stock-assistant/shared';
import { prisma } from '../../infrastructure/prisma';
import { runWorker } from '../../infrastructure/workerRunner';

export interface SecurityLookup {
  name: string | null;
}

export async function lookupSecurity(code: string): Promise<SecurityLookup> {
  if (!isValidStockCode(code)) return { name: null };
  const result = await runWorker({ script: 'lookup_stock.py', args: [code], timeoutMs: 15_000 });
  const data = result.parsed as { ok?: boolean; name?: string; price?: number; pct?: number } | null;
  if (!result.ok || !data?.ok) return { name: null };
  return { name: data.name ?? null };
}

export async function ensureStock(code: string, name: string, assetType: AssetType, db: Pick<Prisma.TransactionClient, 'stock'> = prisma) {
  const stock = await db.stock.upsert({
    where: { code },
    create: { code, name, assetType, market: 'A股' },
    update: {}
  });
  if (stock.name === code && name !== code) {
    return db.stock.update({ where: { code }, data: { name } });
  }
  return stock;
}
