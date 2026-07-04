import fs from 'fs';
import path from 'path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import dotenv from 'dotenv';
import { testClaudeConnection, testTushareConnection } from '../services/settingService';

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        value: z.string().max(10_000)
      })
    )
    .min(1)
});

const deleteSchema = z.object({ key: z.string().min(1).max(100) });
const testSchema = z.object({ token: z.string().min(1) });
const claudeTestSchema = z.object({ apiKey: z.string().min(1), model: z.string().min(1) });

// Map setting keys to env var names
const SETTING_TO_ENV: Record<string, string> = {
  'tushare.token': 'TUSHARE_TOKEN',
  'claude.apiKey': 'ANTHROPIC_API_KEY',
  'claude.defaultModel': 'CLAUDE_DEFAULT_MODEL',
  'claude.deepModel': 'CLAUDE_DEEP_MODEL',
  'app.refreshIntervalMinutes': 'REFRESH_INTERVAL_MINUTES',
};

const ENV_TO_SETTING: Record<string, string> = Object.fromEntries(
  Object.entries(SETTING_TO_ENV).map(([k, v]) => [v, k])
);

function getEnvPath(): string {
  // .env is in the project root, one level up from services/api
  return path.resolve(process.cwd(), '..', '..', '.env');
}

function loadEnv(): Record<string, string> {
  const envPath = getEnvPath();
  const result: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        result[key] = value;
      }
    }
  }
  return result;
}

function saveEnv(values: Record<string, string>): void {
  const envPath = getEnvPath();
  const existing = loadEnv();
  const merged = { ...existing, ...values };
  const lines = Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
  // Update process.env
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined && v !== null) {
      process.env[k] = v;
    }
  }
}

function toSettingEntry(key: string, value: string) {
  return {
    id: -1,
    key,
    value,
    updatedAt: new Date().toISOString()
  };
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const envVars = loadEnv();
    const items = Object.entries(SETTING_TO_ENV)
      .filter(([, envKey]) => envVars[envKey])
      .map(([settingKey, envKey]) => toSettingEntry(settingKey, envVars[envKey]));
    return { items };
  });

  app.put('/', async (request) => {
    const body = bulkSchema.parse(request.body);
    const toSave: Record<string, string> = {};
    for (const item of body.items) {
      const envKey = SETTING_TO_ENV[item.key];
      if (!envKey) continue; // Skip unknown keys
      toSave[envKey] = item.value;
    }
    saveEnv(toSave);
    const items = Object.entries(toSave).map(([envKey, value]) => toSettingEntry(ENV_TO_SETTING[envKey], value));
    return { items };
  });

  app.delete('/', async (request, reply) => {
    const { key } = deleteSchema.parse(request.query as Record<string, string>);
    const envKey = SETTING_TO_ENV[key];
    if (!envKey) {
      reply.code(404);
      return { error: '设置项不存在' };
    }
    const envVars = loadEnv();
    if (!envVars[envKey]) {
      reply.code(404);
      return { error: '设置项不存在' };
    }
    const { [envKey]: _, ...rest } = envVars;
    const lines = Object.entries(rest)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${v}`);
    fs.writeFileSync(getEnvPath(), lines.join('\n') + '\n', 'utf-8');
    delete process.env[envKey];
    return { ok: true, key };
  });

  app.post('/test-tushare', async (request) => {
    const { token } = testSchema.parse(request.body ?? {});
    return testTushareConnection(token);
  });

  app.post('/test-claude', async (request) => {
    const body = claudeTestSchema.parse(request.body ?? {});
    return testClaudeConnection(body.apiKey, body.model);
  });
}
