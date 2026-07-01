import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const servicesApiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const workerDir = resolve(servicesApiDir, '..', 'worker');
const scriptsDir = resolve(workerDir, 'scripts');
const projectRoot = resolve(servicesApiDir, '..', '..');

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

function resolveInterpreter(): string {
  return process.env.WORKER_PYTHON?.trim() || (process.platform === 'win32' ? 'python' : 'python3');
}

export async function runWorker(options: WorkerOptions): Promise<WorkerResult> {
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

  // Allow DATABASE_URL override but default to project-level data/stock.db
  if (!env.DATABASE_URL) {
    env.DATABASE_URL = `file:${resolve(projectRoot, 'data', 'stock.db')}`;
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

      resolvePromise({
        ok: !killed && code === 0,
        exitCode: code,
        durationMs,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        parsed,
        error: killed ? `Worker timed out after ${timeoutMs}ms` : code === 0 ? undefined : `Worker exited with code ${code}`
      });
    });
  });
}
