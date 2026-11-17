import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

function findProjectRoot(): string {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(resolve(directory, 'prisma/schema.prisma'))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Cannot locate prisma/schema.prisma');
    directory = parent;
  }
  return directory;
}

export const projectRoot = findProjectRoot();
dotenv.config({ path: resolve(projectRoot, '.env') });
export const workerDir = resolve(projectRoot, 'services/worker');
export const scriptsDir = resolve(workerDir, 'scripts');

export function resolveDatabaseUrl(value = process.env.DATABASE_URL): string {
  const raw = value?.trim() || 'file:../data/stock.db';
  if (!raw.startsWith('file:')) throw new Error('DATABASE_URL must use a SQLite file: URL');
  const path = raw.slice(5);
  if (!path) throw new Error('DATABASE_URL must contain a file path');
  return `file:${isAbsolute(path) ? path : resolve(projectRoot, 'prisma', path)}`;
}

export function resolveInterpreter(): string {
  return process.env.WORKER_PYTHON?.trim() || (process.platform === 'win32' ? 'python' : 'python3');
}

export const apiPort = Number(process.env.API_PORT ?? 4000);
export const apiHost = process.env.API_HOST ?? '127.0.0.1';
export const webOrigins = process.env.WEB_ORIGIN?.split(',').map(value => value.trim()).filter(Boolean)
  ?? [`http://localhost:${process.env.WEB_PORT ?? 3000}`, `http://127.0.0.1:${process.env.WEB_PORT ?? 3000}`];
