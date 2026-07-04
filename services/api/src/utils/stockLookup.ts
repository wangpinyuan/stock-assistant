import { execSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isValidStockCode } from '@stock-assistant/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface StockLookupResult {
  name: string | null;
  assetType: 'stock' | 'etf';
  currentPrice?: number;
  changePercent?: number;
}

export interface StockNameLookupResult {
  name: string;
}

export function lookupStock(code: string): StockLookupResult {
  if (!isValidStockCode(code)) {
    return { name: null, assetType: 'stock' };
  }
  try {
    const scriptsDir = resolve(__dirname, '..', '..', '..', 'worker', 'scripts');
    const result = execSync(`python3 "${scriptsDir}/lookup_stock.py" "${code}"`, {
      timeout: 15000,
      encoding: 'utf-8'
    });
    const data = JSON.parse(result) as { ok: boolean; name?: string; price?: number; pct?: number; error?: string };
    if (!data.ok) return { name: null, assetType: 'stock' };
    return {
      name: data.name ?? null,
      assetType: 'stock',
      currentPrice: data.price,
      changePercent: data.pct
    };
  } catch {
    return { name: null, assetType: 'stock' };
  }
}

export function lookupStockNames(codes: string[]): Map<string, string> {
  const result = new Map<string, string>();
  if (codes.length === 0) return result;
  try {
    const scriptsDir = resolve(__dirname, '..', '..', '..', 'worker', 'scripts');
    const joined = codes.join(',');
    const output = execSync(`python3 "${scriptsDir}/lookup_stock.py" "${joined}" --batch`, {
      timeout: 30000,
      encoding: 'utf-8'
    });
    const data = JSON.parse(output) as { ok: boolean; items?: Array<{ code: string; name: string }> };
    if (data.ok && data.items) {
      for (const item of data.items) {
        result.set(item.code, item.name);
      }
    }
  } catch (err) {
    console.error('[ERROR] lookupStockNames failed:', err);
  }
  return result;
}

export interface StockPriceData {
  price: number;
  change: number;
  pct: number;
}

export function lookupStockPrices(codes: string[]): Map<string, StockPriceData> {
  const result = new Map<string, StockPriceData>();
  if (codes.length === 0) return result;
  try {
    const scriptsDir = resolve(__dirname, '..', '..', '..', 'worker', 'scripts');
    const joined = codes.join(',');
    const output = execSync(`python3 "${scriptsDir}/lookup_stock.py" "${joined}" --batch`, {
      timeout: 30000,
      encoding: 'utf-8'
    });
    const data = JSON.parse(output) as { ok: boolean; items?: Array<{ code: string; price: number; change: number; pct: number }> };
    if (data.ok && data.items) {
      for (const item of data.items) {
        result.set(item.code, { price: item.price, change: item.change, pct: item.pct });
      }
    }
  } catch (err) {
    console.error('[ERROR] lookupStockPrices failed:', err);
  }
  return result;
}

export async function ensureStockExists(prisma: any, code: string, name: string, assetType: 'stock' | 'etf' = 'stock') {
  return prisma.stock.upsert({
    where: { code },
    create: { code, name, assetType, market: 'A股' },
    update: {}
  });
}
