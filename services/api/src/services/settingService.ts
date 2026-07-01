import { prisma } from '../plugins/prisma';

export interface SettingEntry {
  id: number;
  key: string;
  value: string;
  updatedAt: string;
}

function toEntry(record: { id: number; key: string; value: string; updatedAt: Date }): SettingEntry {
  return {
    id: record.id,
    key: record.key,
    value: record.value,
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function listSettings() {
  const items = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  return { items: items.map(toEntry) };
}

export async function upsertSetting(key: string, value: string) {
  const setting = await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value }
  });
  return toEntry(setting);
}

export async function bulkUpsertSettings(entries: Array<{ key: string; value: string }>) {
  const results: SettingEntry[] = [];
  for (const entry of entries) {
    const trimmedKey = entry.key.trim();
    if (!trimmedKey) continue;
    const saved = await upsertSetting(trimmedKey, entry.value);
    results.push(saved);
  }
  return { items: results };
}

export async function deleteSetting(key: string) {
  const existing = await prisma.setting.findUnique({ where: { key } });
  if (!existing) return null;
  await prisma.setting.delete({ where: { key } });
  return { key };
}

export async function getSettingValue(key: string): Promise<string | null> {
  const record = await prisma.setting.findUnique({ where: { key } });
  return record?.value ?? null;
}

export async function testTushareConnection(token: string): Promise<{ ok: boolean; message: string }> {
  if (!token.trim()) {
    return { ok: false, message: '未提供 Tushare Token' };
  }
  try {
    const response = await fetch(`https://api.tushare.pro`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_name: 'stock_basic',
        token,
        params: { list_status: 'L', limit: 1 },
        fields: 'ts_code,name'
      })
    });

    if (!response.ok) {
      return { ok: false, message: `Tushare HTTP ${response.status}` };
    }
    const data = (await response.json()) as { code?: number; msg?: string; data?: unknown };
    if (data.code !== 0) {
      return { ok: false, message: data.msg ?? 'Tushare 返回错误' };
    }
    return { ok: true, message: 'Tushare 连接成功' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Tushare 请求失败' };
  }
}

export async function testClaudeConnection(
  apiKey: string,
  model: string
): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim()) {
    return { ok: false, message: '未提供 Anthropic API Key' };
  }
  if (!model.trim()) {
    return { ok: false, message: '未指定模型' };
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'ping' }]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: `Claude HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, message: 'Claude 连接成功' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Claude 请求失败' };
  }
}
