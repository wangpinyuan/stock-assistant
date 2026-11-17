import { z } from 'zod';

export const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(100),
        value: z.string().max(10_000)
      })
    )
    .min(1)
});

export const deleteSchema = z.object({ key: z.string().trim().min(1).max(100) });

export const testSchema = z.object({ token: z.string().trim().optional() });
export const claudeTestSchema = z.object({ apiKey: z.string().trim().optional(), model: z.string().trim().optional() });
