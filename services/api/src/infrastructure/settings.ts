import { prisma } from './prisma';

export async function getSettingValue(key: string): Promise<string | null> {
  const record = await prisma.setting.findUnique({ where: { key } });
  return record?.value ?? null;
}

export async function getConfiguredValue(key: string, environmentKey: string): Promise<string> {
  return (await getSettingValue(key))?.trim() || process.env[environmentKey]?.trim() || '';
}
