import { z } from 'zod';

export const watchlistInputSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, '股票代码须为六位数字'),
  name: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
  note: z.string().max(500).nullish()
});

export const watchlistUpdateSchema = z
  .object({
    sortOrder: z.number().int().optional(),
    note: z.string().max(500).nullish()
  })
  .refine((value) => Object.keys(value).length > 0, { message: '至少提供一个可更新字段' });

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
