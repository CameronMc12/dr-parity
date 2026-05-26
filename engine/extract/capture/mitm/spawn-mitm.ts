/**
 * Lifecycle wrapper around `mitmdump` running the Dr Parity capture addon.
 *
 * mitmdump is an OPTIONAL transport-capture layer. If it is not installed this
 * module never throws on import or on availability checks — callers gate on
 * {@link isMitmAvailable} and degrade to Playwright-only capture. The build is
 * never failed by a missing mitmproxy.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADDON_FILENAME = 'mitm_addon.py';
const READY_PATTERN = /Proxy server listening|HTTP\(S\) proxy listening|writing flows to/i;
const READY_TIMEOUT_MS = 15_000;
const INSTALL_HINT = 'brew install mitmproxy  (or: pipx install mitmproxy)';

function addonPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, ADDON_FILENAME);
}

/**
 * True when `mitmdump` resolves on PATH. Result is cached for the process.
 * Never throws — a missing binary returns false.
 */
let cachedAvailable: boolean | undefined;
export function isMitmAvailable(): boolean {
  if (cachedAvailable !== undefined) return cachedAvailable;
  try {
    const probe = spawnSync('mitmdump', ['--version'], { stdio: 'ignore' });
    cachedAvailable = probe.status === 0 || probe.status === null && !probe.error;
    if (probe.error) cachedAvailable = false;
  } catch {
    cachedAvailable = false;
  }
  return cachedAvailable;
}

/** Human-readable install guidance, surfaced when mitmdump is missing. */
export function mitmInstallHint(): string {
  return INSTALL_HINT;
}

export type MitmHandle = {
  /** TCP port mitmdump is listening on. */
  port: number;
  /** Absolute path to the NDJSON flow log being written. */
  outPath: string;
  /** Resolves once mitmdump reports it is listening (or on ready-timeout). */
  ready: () => Promise<void>;
  /** Stop the child process and resolve when it has exited. */
  stop: () => Promise<void>;
};

export type SpawnMitmOptions = {
  /** Listen port for the proxy. */
  port: number;
  /** NDJSON output path; wired to the addon via DRPARITY_MITM_OUT. */
  outPath: string;
  /** Extra mitmdump CLI args, appended verbatim. */
  extraArgs?: string[];
};

/**
 * Start `mitmdump -s mitm_addon.py --listen-port <port>` as a child process.
 *
 * Returns null (and logs install guidance) when mitmdump is unavailable, so the
 * caller can proceed without transport capture rather than crash.
 */
export function spawnMitm(opts: SpawnMitmOptions): MitmHandle | null {
  if (!isMitmAvailable()) {
    console.warn(`[mitm] mitmdump not found on PATH — skipping transport capture. Install: ${INSTALL_HINT}`);
    return null;
  }

  const addon = addonPath();
  if (!existsSync(addon)) {
    console.warn(`[mitm] addon missing at ${addon} — skipping transport capture.`);
    return null;
  }

  const args = [
    '-s',
    addon,
    '--listen-port',
    String(opts.port),
    '--set',
    'flow_detail=0',
    ...(opts.extraArgs ?? []),
  ];

  const child: ChildProcess = spawn('mitmdump', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DRPARITY_MITM_OUT: opts.outPath },
  });

  let resolveReady: () => void;
  let readyResolved = false;
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = () => {
      if (readyResolved) return;
      readyResolved = true;
      resolve();
    };
  });

  const onData = (buf: Buffer) => {
    const text = buf.toString('utf8');
    if (READY_PATTERN.test(text)) resolveReady();
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);

  child.on('exit', (code) => {
    if (!readyResolved) resolveReady();
    if (code && code !== 0) console.warn(`[mitm] mitmdump exited with code ${code}`);
  });

  const ready = async (): Promise<void> => {
    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (!readyResolved) console.warn('[mitm] ready-timeout reached; proceeding anyway');
        resolveReady();
        resolve();
      }, READY_TIMEOUT_MS);
    });
    await Promise.race([readyPromise, timeout]);
  };

  const stop = async (): Promise<void> => {
    if (child.exitCode !== null || child.killed) return;
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
        resolve();
      }, 4_000);
    });
  };

  return { port: opts.port, outPath: opts.outPath, ready, stop };
}
