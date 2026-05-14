import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve as resolvePath } from 'node:path';
import { stat } from 'node:fs/promises';
import type { ServerHandle } from './types';

const PORT_RANGE_START = 5070;
const PORT_RANGE_END = 5099;
const READINESS_TIMEOUT_MS = 30_000;
const READINESS_POLL_MS = 200;

function probePort(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

export async function pickFreePorts(count: number): Promise<number[]> {
  if (count <= 0) throw new Error('pickFreePorts: count must be positive');
  const picked: number[] = [];
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END && picked.length < count; port++) {
    const free = await probePort(port);
    if (free) picked.push(port);
  }
  if (picked.length < count) {
    throw new Error(
      `pickFreePorts: could not find ${count} free ports in range ${PORT_RANGE_START}-${PORT_RANGE_END}`,
    );
  }
  return picked;
}

function resolveServeBin(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('serve/package.json');
  return resolvePath(pkgPath, '..', 'build', 'main.js');
}

async function assertDirWithIndex(dir: string): Promise<void> {
  const dirStat = await stat(dir).catch(() => null);
  if (!dirStat || !dirStat.isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }
  const indexStat = await stat(resolvePath(dir, 'index.html')).catch(() => null);
  if (!indexStat || !indexStat.isFile()) {
    throw new Error(`Missing index.html in: ${dir}`);
  }
}

async function waitForReady(
  url: string,
  isAlive: () => boolean,
  timeoutMs: number,
  pollMs: number,
): Promise<void> {
  const start = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - start < timeoutMs) {
    if (!isAlive()) {
      throw new Error(
        `Process exited before becoming ready at ${url}: ${
          lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'unknown')
        }`,
      );
    }
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status >= 200 && res.status < 500) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `Timeout after ${timeoutMs}ms waiting for ${url}: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'unknown')
    }`,
  );
}

function spawnServe(dir: string, port: number): ChildProcess {
  const serveBin = resolveServeBin();
  const child = spawn(
    process.execPath,
    [serveBin, dir, '--listen', String(port), '--no-clipboard', '--no-port-switching'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    },
  );
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});
  return child;
}

export async function bootServer(dir: string, port: number): Promise<ServerHandle> {
  await assertDirWithIndex(dir);
  const child = spawnServe(dir, port);
  const pid = child.pid;
  if (pid == null) {
    throw new Error(`serve failed to spawn for ${dir}`);
  }

  let exited = false;
  child.once('exit', () => {
    exited = true;
  });

  const url = `http://127.0.0.1:${port}/`;

  try {
    await waitForReady(url, () => !exited, READINESS_TIMEOUT_MS, READINESS_POLL_MS);
  } catch (err) {
    try {
      child.kill('SIGTERM');
    } catch {}
    throw new Error(
      `Failed to start serve for dir=${dir} port=${port}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const kill = (): void => {
    if (child.exitCode != null || child.signalCode != null) return;
    try {
      child.kill('SIGTERM');
    } catch {}
    setTimeout(() => {
      if (child.exitCode == null && child.signalCode == null) {
        try {
          child.kill('SIGKILL');
        } catch {}
      }
    }, 2_000).unref();
  };

  return { port, url, pid, kill };
}

export async function bootServers(
  cloneDir: string,
  rebuiltDir: string,
): Promise<{ cloneServer: ServerHandle; rebuiltServer: ServerHandle }> {
  const [clonePort, rebuiltPort] = await pickFreePorts(2);
  const cloneServer = await bootServer(cloneDir, clonePort!);
  let rebuiltServer: ServerHandle;
  try {
    rebuiltServer = await bootServer(rebuiltDir, rebuiltPort!);
  } catch (err) {
    cloneServer.kill();
    throw err;
  }
  return { cloneServer, rebuiltServer };
}
