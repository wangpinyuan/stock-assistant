import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });
const command = process.argv[2];
if (!['dev', 'build', 'start'].includes(command)) throw new Error('Expected dev, build, or start');
const args = [resolve(root, 'node_modules/next/dist/bin/next'), command];
if (command !== 'build') args.push('-p', process.env.WEB_PORT || '3000');
const child = spawn(process.execPath, args, { cwd: resolve(root, 'apps/web'), env: process.env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
