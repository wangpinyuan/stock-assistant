import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWorker } from '../src/infrastructure/workerRunner';

test('starts the actual Python script independently of the caller directory', async () => {
  const original = process.cwd();
  try {
    process.chdir('/tmp');
    const result = await runWorker({ script: 'lookup_stock.py', args: ['--help'] });
    assert.equal(result.ok, true, result.error ?? result.stderr);
    assert.match(result.stdout, /Look up stock info/);
  } finally {
    process.chdir(original);
  }
});

test('returns a failure when the Python interpreter is missing', async () => {
  const original = process.env.WORKER_PYTHON;
  process.env.WORKER_PYTHON = '/nonexistent/stock-assistant-python';
  try {
    const result = await runWorker({ script: 'lookup_stock.py', args: ['--help'] });
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /ENOENT/);
  } finally {
    if (original === undefined) delete process.env.WORKER_PYTHON;
    else process.env.WORKER_PYTHON = original;
  }
});

test('identical concurrent updates share a single process and timeout is observable', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { resolve } = await import('node:path');
  const directory = await mkdtemp(resolve(tmpdir(), 'worker-timeout-'));
  try {
    const script = resolve(directory, 'slow.py');
    await writeFile(script, 'import time\ntime.sleep(5)\nprint("{}")\n');
    const options = { script, timeoutMs: 50 };
    const first = runWorker(options);
    const second = runWorker(options);
    assert.equal(first, second);
    const result = await first;
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /timed out/);
    const retry = runWorker(options);
    assert.notEqual(retry, first);
    await retry;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a JSON failure overrides a zero process exit code', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { resolve } = await import('node:path');
  const directory = await mkdtemp(resolve(tmpdir(), 'worker-failure-'));
  try {
    const script = resolve(directory, 'failure.py');
    await writeFile(script, 'print(\'{"ok": false, "error": "provider unavailable"}\')\n');
    const result = await runWorker({ script });
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /provider unavailable/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
