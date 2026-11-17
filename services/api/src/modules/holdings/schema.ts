import { z } from 'zod';

export const holdingInputSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, '股票代码须为六位数字'),
  name: z.string().trim().max(50).optional(),
  quantity: z.number().positive(),
  averageCost: z.number().nonnegative(),
  assetType: z.enum(['stock', 'etf']).optional(),
  buyDate: z.string().date().nullish(),
  tags: z.string().max(200).nullish(),
  note: z.string().max(1000).nullish()
});

export const holdingUpdateSchema = holdingInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '至少提供一个可更新字段' }
);

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
