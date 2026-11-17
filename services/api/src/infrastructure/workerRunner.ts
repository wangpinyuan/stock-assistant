import { spawn } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { getConfiguredValue } from './settings';
import { workerDir, scriptsDir, resolveDatabaseUrl, resolveInterpreter } from './config';

export interface WorkerOptions {
  script: string;
  args?: string[];
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface WorkerResult {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  parsed: unknown | null;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;

async function executeWorker(options: WorkerOptions): Promise<WorkerResult> {
  const interpreter = resolveInterpreter();
  const scriptPath = resolve(scriptsDir, options.script);
  const args = options.args ?? [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    ...options.env
  };

  env.DATABASE_URL = resolveDatabaseUrl(env.DATABASE_URL);
  if (['update_quotes.py', 'update_kline.py'].includes(basename(options.script))) {
    env.TUSHARE_TOKEN = options.env?.TUSHARE_TOKEN ?? await getConfiguredValue('tushare.token', 'TUSHARE_TOKEN');
  }

  return new Promise<WorkerResult>((resolvePromise) => {
    const start = Date.now();
    const child = spawn(interpreter, [scriptPath, ...args], {
      cwd: workerDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolvePromise({
        ok: false,
        exitCode: null,
        durationMs: Date.now() - start,
        stdout,
        stderr,
        parsed: null,
        error: error.message
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;

      const lastLine = stdout.trim().split(/\r?\n/).pop() ?? '';
      let parsed: unknown = null;
      if (lastLine) {
        try {
          parsed = JSON.parse(lastLine);
        } catch {
          parsed = null;
        }
      }

      const reportedFailure = parsed !== null && typeof parsed === 'object' && 'ok' in parsed && parsed.ok === false;
      const reportedError = parsed !== null && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
        ? parsed.error : undefined;
      let error: string | undefined;
      if (killed) error = `Worker timed out after ${timeoutMs}ms`;
      else if (code !== 0 || reportedFailure) error = reportedError ?? `Worker exited with code ${code}`;

      resolvePromise({
        ok: !killed && code === 0 && !reportedFailure,
        exitCode: code,
        durationMs,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        parsed,
        error
      });
    });
  });
}


const runningWorkers = new Map<string, Promise<WorkerResult>>();

export function runWorker(options: WorkerOptions): Promise<WorkerResult> {
  const key = JSON.stringify([options.script, options.args ?? [], options.env, resolveDatabaseUrl(), resolveInterpreter()]);
  const existing = runningWorkers.get(key);
  if (existing) return existing;
  const task = executeWorker(options).finally(() => runningWorkers.delete(key));
  runningWorkers.set(key, task);
  return task;
}
