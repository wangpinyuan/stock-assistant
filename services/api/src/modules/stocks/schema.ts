import { z } from 'zod';

export const codeSchema = z.object({ code: z.string().regex(/^(?:\d{6}|(?:sh|sz)\d{6}|hkHSI|usixic|usspx)$/) });
export const periodSchema = z.object({ period: z.enum(['daily', 'weekly', 'monthly', 'intraday']).default('daily') });
