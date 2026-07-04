import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = process.cwd();
const workerDir = resolve(projectRoot, 'services', 'worker');
const scriptsDir = resolve(workerDir, 'scripts');

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
  if (process.env.WORKER_PYTHON?.trim()) return process.env.WORKER_PYTHON.trim();
  if (process.platform === 'win32') return 'python';
  // Default to /usr/bin/python3 to avoid PATH issues in spawned processes
  return '/usr/bin/python3';
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
    console.error(`[workerRunner] spawning: ${interpreter} ${scriptPath} ${args.join(' ')}`);
    const child = spawn(interpreter, [scriptPath, ...args], {
      cwd: workerDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
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

    child.on('error', (error: Error & { errno?: number; code?: string; path?: string }) => {
      clearTimeout(timer);
      console.error(`[workerRunner] spawn error: ${error.message}`, { interpreter, scriptPath, args, errno: error.errno, code: error.code, path: error.path });
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
