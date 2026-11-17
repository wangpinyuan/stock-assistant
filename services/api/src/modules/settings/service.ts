export { getConfiguredValue } from '../../infrastructure/settings';
import type { SettingEntry } from '@stock-assistant/shared';
import { prisma } from '../../infrastructure/prisma';


export const SECRET_SETTING_KEYS = new Set(['tushare.token', 'claude.apiKey']);

function toEntry(record: { id: number; key: string; value: string; updatedAt: Date }): SettingEntry {
  return {
    id: record.id,
    key: record.key,
    value: SECRET_SETTING_KEYS.has(record.key) ? '' : record.value,
    configured: Boolean(record.value.trim()),
    secret: SECRET_SETTING_KEYS.has(record.key),
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function listSettings() {
  const items = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  return { items: items.map(toEntry) };
}

export async function bulkUpsertSettings(entries: Array<{ key: string; value: string }>) {
  const changes = entries.map(entry => ({ key: entry.key.trim(), value: entry.value }))
    .filter(entry => entry.key && !(SECRET_SETTING_KEYS.has(entry.key) && !entry.value.trim()));
  const records = await prisma.$transaction(changes.map(({ key, value }) => prisma.setting.upsert({
    where: { key }, create: { key, value }, update: { value }
  })));
  return { items: records.map(toEntry) };
}

export async function renameSetting(from: string, to: string, value: string) {
  if (SECRET_SETTING_KEYS.has(from) || SECRET_SETTING_KEYS.has(to)) {
    throw Object.assign(new Error('密钥设置的键名不可更改'), { statusCode: 400 });
  }
  return prisma.$transaction(async tx => {
    if (from !== to) {
      const existing = await tx.setting.findUnique({ where: { key: to } });
      if (existing) throw Object.assign(new Error('目标键已存在'), { statusCode: 409 });
    }
    return toEntry(await tx.setting.update({ where: { key: from }, data: { key: to, value } }));
  });
}

export async function deleteSetting(key: string) {
  const existing = await prisma.setting.findUnique({ where: { key } });
  if (!existing) return null;
  await prisma.setting.delete({ where: { key } });
  return { key };
}


export async function testTushareConnection(token: string): Promise<{ ok: boolean; message: string }> {
  if (!token.trim()) {
    return { ok: false, message: '未提供 Tushare Token' };
  }
  try {
    const response = await fetch(`https://api.tushare.pro`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
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
      return { ok: false, message: `Tushare API 返回错误 (${data.code ?? 'unknown'})` };
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
      signal: AbortSignal.timeout(15_000),
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
      return { ok: false, message: `Claude HTTP ${response.status}` };
    }
    return { ok: true, message: 'Claude 连接成功' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Claude 请求失败' };
  }
}



export async function getPublicSetting(key: string) {
  const record = await prisma.setting.findUnique({ where: { key } });
  return record ? toEntry(record) : null;
}
