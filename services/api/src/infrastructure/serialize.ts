import { Prisma } from '@prisma/client';

export function serializeResponse(value: unknown): unknown {
  if (value == null) return value;
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeResponse);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeResponse(item)]));
  }
  return value;
}
