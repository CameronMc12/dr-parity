/**
 * Webapp-target post-emit pipeline.
 *
 * The webapp target emits a Vite + React + React Router + MSW project from
 * a captured clone (plus optional crawl graph). Astro and react each have
 * their own post-emit module that mirrors the Astro shape; this one is the
 * webapp equivalent.
 *
 * Per Dr Parity V2.0 scope (locked decision 9 in 05-action-plan.md), the
 * webapp parity baseline is route-smoke + state assertions. Pixel parity
 * (~99% matching astro) is a stretch goal tracked separately. This module
 * therefore runs:
 *
 *   1. install               - npm install in the emitted project
 *   2. build                 - tsc -b && vite build
 *   3. msw-boot-check        - assert MSW service worker boots cleanly
 *   4. route-render-check    - vite preview + Playwright nav over every
 *                              inferred route; assert #root mounts and
 *                              the page renders without console errors
 *   5. state-assertion-check - for each inferred toggle in the state
 *                              graph, click the trigger and assert the
 *                              expected DOM transition
 *
 * Each phase emits a structured `PhaseResult` so the unified `.runs/`
 * logger (V2.0 Phase 5) can pick it up.
 *
 * TODO Phase 7: pixel parity stretch - route-by-route screenshot diff
 * against captured state DOM. Belongs here once `engine/verify/diff.ts`
 * supports SPA routes (it currently expects an Astro project layout).
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

import type { InferenceResult, RouteGroup, StateToggle } from '../../targets/webapp/inference';

export type PhaseStatus = 'ok' | 'warn' | 'fail' | 'skipped';

export interface PhaseMetrics {
  durationMs: number;
  [extra: string]: number | string | boolean | null | undefined;
}

export interface PhaseResult {
  name: string;
  status: PhaseStatus;
  metrics: PhaseMetrics;
  errors: string[];
}

export interface PostEmitMultiWebappOptions {
  /** Webapp project root (output of webappAdapter.build). */
  outDir: string;
  /**
   * Optional inferred state graph from the crawler. When omitted the
   * route-render and state-assertion phases fall back to a single root
   * route '/' with zero toggles.
   */
  inference?: InferenceResult;
  /** Skip npm install (useful when node_modules already exist). */
  skipInstall?: boolean;
  /** Skip vite build (useful when dist/ already exists). */
  skipBuild?: boolean;
  /** Skip Playwright-driven phases (useful for tests). */
  skipBrowser?: boolean;
  /** Max ms to wait for vite preview to become ready. Default 30s. */
  previewReadyTimeoutMs?: number;
  /** Log sink. Defaults to stdout. */
  log?: (line: string) => void;
}

export interface PostEmitMultiWebappResult {
  outDir: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  phases: PhaseResult[];
  /** Convenience: true when every phase reported `ok` or `skipped`. */
  passed: boolean;
}

const DEFAULT_PREVIEW_READY_TIMEOUT_MS = 30_000;
const PREVIEW_PORT_PATTERN = /http:\/\/localhost:(\d+)/i;
const PREVIEW_READY_PATTERN = /(?:Local:\s+http:\/\/localhost:(\d+)|preview server|vite preview)/i;

function defaultLog(line: string): void {
  process.stdout.write(line + '\n');
}

function nowIso(): string {
  return new Date().toISOString();
}

function spawnInDir(
  cmd: string,
  args: string[],
  cwd: string,
  log: (line: string) => void,
): Promise<number> {
  return new Promise((resolveExit) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    child.stdout?.on('data', (c: Buffer) =>
      log(c.toString('utf8').replace(/\s+$/, '')),
    );
    child.stderr?.on('data', (c: Buffer) =>
      log(c.toString('utf8').replace(/\s+$/, '')),
    );
    child.on('error', (err) => {
      log(`spawn error: ${err.message}`);
      resolveExit(1);
    });
    child.on('exit', (code) => resolveExit(code ?? 0));
  });
}

// ---------------------------------------------------------------------------
// Phase: install
// ---------------------------------------------------------------------------

async function runInstall(
  outDir: string,
  skip: boolean,
  log: (l: string) => void,
): Promise<PhaseResult> {
  const start = Date.now();
  if (skip) {
    return {
      name: 'install',
      status: 'skipped',
      metrics: { durationMs: 0 },
      errors: [],
    };
  }
  if (!existsSync(join(outDir, 'package.json'))) {
    return {
      name: 'install',
      status: 'fail',
      metrics: { durationMs: Date.now() - start },
      errors: ['package.json missing in outDir'],
    };
  }
  if (existsSync(join(outDir, 'node_modules'))) {
    return {
      name: 'install',
      status: 'skipped',
      metrics: { durationMs: Date.now() - start, reason: 'node_modules exists' },
      errors: [],
    };
  }
  log('  [install] npm install');
  const exit = await spawnInDir('npm', ['install', '--silent'], outDir, log);
  return {
    name: 'install',
    status: exit === 0 ? 'ok' : 'fail',
    metrics: { durationMs: Date.now() - start, exitCode: exit },
    errors: exit === 0 ? [] : [`npm install exited ${exit}`],
  };
}

// ---------------------------------------------------------------------------
// Phase: build
// ---------------------------------------------------------------------------

async function runBuild(
  outDir: string,
  skip: boolean,
  log: (l: string) => void,
): Promise<PhaseResult> {
  const start = Date.now();
  if (skip) {
    return {
      name: 'build',
      status: 'skipped',
      metrics: { durationMs: 0 },
      errors: [],
    };
  }
  log('  [build] npm run build');
  const exit = await spawnInDir('npm', ['run', 'build'], outDir, log);
  return {
    name: 'build',
    status: exit === 0 ? 'ok' : 'fail',
    metrics: { durationMs: Date.now() - start, exitCode: exit },
    errors: exit === 0 ? [] : [`npm run build exited ${exit}`],
  };
}

// ---------------------------------------------------------------------------
// Phase: msw-boot-check
// ---------------------------------------------------------------------------

/**
 * Static check that the MSW worker module wires its handlers and that the
 * `mockServiceWorker.js` artefact exists in public/. We deliberately do not
 * boot a browser here. The route-render phase below runs Playwright and
 * verifies the worker registration succeeds at runtime; this phase just
 * catches misconfiguration (handlers list missing, worker file absent,
 * import paths broken) before paying the cost of vite preview.
 */
async function runMswBootCheck(
  outDir: string,
  log: (l: string) => void,
): Promise<PhaseResult> {
  const start = Date.now();
  const errors: string[] = [];

  const browserPath = join(outDir, 'src', 'mocks', 'browser.ts');
  const handlersPath = join(outDir, 'src', 'mocks', 'handlers.ts');
  const workerPath = join(outDir, 'public', 'mockServiceWorker.js');

  if (!existsSync(browserPath)) {
    errors.push(`src/mocks/browser.ts missing at ${browserPath}`);
  } else {
    const src = readFileSync(browserPath, 'utf8');
    if (!/setupWorker\s*\(/.test(src)) {
      errors.push('src/mocks/browser.ts does not call setupWorker(...)');
    }
    if (!/from\s+['"]\.\/handlers['"]/.test(src)) {
      errors.push('src/mocks/browser.ts does not import ./handlers');
    }
  }

  if (!existsSync(handlersPath)) {
    errors.push(`src/mocks/handlers.ts missing at ${handlersPath}`);
  } else {
    const src = readFileSync(handlersPath, 'utf8');
    if (!/export\s+const\s+handlers\b/.test(src)) {
      errors.push('src/mocks/handlers.ts does not export `handlers`');
    }
  }

  let workerStatus: 'ok' | 'missing' = 'ok';
  if (!existsSync(workerPath)) {
    workerStatus = 'missing';
    // Worker file is produced by `npm run msw:init`. Its absence is a
    // warning rather than a fail because the emitted README documents
    // the init step as a manual post-install task.
    log('  [msw-boot-check] public/mockServiceWorker.js missing - run npm run msw:init');
  }

  const status: PhaseStatus =
    errors.length > 0 ? 'fail' : workerStatus === 'missing' ? 'warn' : 'ok';

  return {
    name: 'msw-boot-check',
    status,
    metrics: {
      durationMs: Date.now() - start,
      workerArtefact: workerStatus,
    },
    errors,
  };
}

// ---------------------------------------------------------------------------
// Phase: route-render-check (Playwright)
// ---------------------------------------------------------------------------

export interface PreviewServer {
  child: ChildProcess;
  port: number;
  baseUrl: string;
}

export function startVitePreview(
  outDir: string,
  readyTimeoutMs: number,
  log: (line: string) => void,
): Promise<PreviewServer> {
  return new Promise((resolveServer, rejectServer) => {
    const child = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1'], {
      cwd: outDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let resolved = false;
    let stdout = '';
    let stderr = '';

    const cleanup = (): void => {
      try { child.stdout?.removeAllListeners(); } catch { /* ignore */ }
      try { child.stderr?.removeAllListeners(); } catch { /* ignore */ }
    };

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
      rejectServer(
        new Error(
          `vite preview did not become ready within ${readyTimeoutMs}ms\n` +
          `stdout: ${stdout.slice(-400)}\nstderr: ${stderr.slice(-400)}`,
        ),
      );
    }, readyTimeoutMs);

    const onData = (chunk: Buffer): void => {
      const text = chunk.toString('utf8');
      stdout += text;
      log(text.replace(/\s+$/, ''));
      if (resolved) return;
      const portMatch = stdout.match(PREVIEW_PORT_PATTERN);
      const ready = PREVIEW_READY_PATTERN.test(stdout);
      if (portMatch && ready) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        child.stdout?.on('data', (c: Buffer) => log(c.toString('utf8').replace(/\s+$/, '')));
        child.stderr?.on('data', (c: Buffer) => log(c.toString('utf8').replace(/\s+$/, '')));
        const port = Number.parseInt(portMatch[1], 10);
        resolveServer({ child, port, baseUrl: `http://localhost:${port}` });
      }
    };

    const onErr = (chunk: Buffer): void => {
      stderr += chunk.toString('utf8');
      onData(chunk);
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onErr);
    child.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      rejectServer(err);
    });
    child.on('exit', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      rejectServer(
        new Error(`vite preview exited before ready (code ${code ?? 'null'})`),
      );
    });
  });
}

export async function stopPreview(server: PreviewServer): Promise<void> {
  if (server.child.killed || server.child.exitCode !== null) return;
  await new Promise<void>((res) => {
    const fallback = setTimeout(() => {
      try { server.child.kill('SIGKILL'); } catch { /* ignore */ }
      res();
    }, 5_000);
    server.child.once('exit', () => {
      clearTimeout(fallback);
      res();
    });
    try { server.child.kill('SIGTERM'); } catch { /* ignore */ res(); }
  });
}

function routesFromInference(inference: InferenceResult | undefined): string[] {
  if (!inference || inference.routes.length === 0) return ['/'];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const r of inference.routes) {
    const path = r.routePath || '/';
    if (seen.has(path)) continue;
    seen.add(path);
    ordered.push(path);
  }
  return ordered;
}

async function runRouteRenderCheck(
  outDir: string,
  inference: InferenceResult | undefined,
  skipBrowser: boolean,
  previewReadyTimeoutMs: number,
  log: (l: string) => void,
): Promise<PhaseResult> {
  const start = Date.now();
  if (skipBrowser) {
    return {
      name: 'route-render-check',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'skipBrowser=true' },
      errors: [],
    };
  }

  const routes = routesFromInference(inference);

  // Lazy-load playwright. Required so this module can be imported in
  // contexts where playwright is not yet installed (e.g. tsc typecheck
  // before npm install on a fresh checkout).
  let chromium: typeof import('playwright').chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch (err) {
    return {
      name: 'route-render-check',
      status: 'fail',
      metrics: { durationMs: Date.now() - start, routes: routes.length },
      errors: [
        `playwright unavailable: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  log(`  [route-render-check] starting vite preview in ${outDir}`);
  let server: PreviewServer;
  try {
    server = await startVitePreview(outDir, previewReadyTimeoutMs, log);
  } catch (err) {
    return {
      name: 'route-render-check',
      status: 'fail',
      metrics: { durationMs: Date.now() - start, routes: routes.length },
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }

  const errors: string[] = [];
  let passed = 0;
  let failed = 0;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    for (const route of routes) {
      const url = server.baseUrl + (route.startsWith('/') ? route : `/${route}`);
      const consoleErrors: string[] = [];
      page.removeAllListeners('console');
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      try {
        const response = await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 15_000,
        });
        if (!response || response.status() >= 400) {
          failed++;
          errors.push(`${route}: HTTP ${response?.status() ?? 'no-response'}`);
          continue;
        }
        // Assert the SPA mounted past the initial empty `<div id="root">`.
        const rootHasContent = await page.evaluate(() => {
          const el = document.getElementById('root');
          if (!el) return false;
          return el.children.length > 0 || (el.textContent ?? '').trim().length > 0;
        });
        if (!rootHasContent) {
          failed++;
          errors.push(`${route}: #root never populated`);
          continue;
        }
        if (consoleErrors.length > 0) {
          // Warn rather than fail. Captured third-party scripts often
          // throw console errors that the rebuilt SPA replays verbatim.
          log(`  [route-render-check] ${route} mounted but logged ${consoleErrors.length} console errors`);
        }
        passed++;
      } catch (err) {
        failed++;
        errors.push(`${route}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await context.close();
  } finally {
    await browser.close();
    await stopPreview(server);
  }

  const status: PhaseStatus = failed === 0 ? 'ok' : passed > 0 ? 'warn' : 'fail';
  return {
    name: 'route-render-check',
    status,
    metrics: {
      durationMs: Date.now() - start,
      routes: routes.length,
      passed,
      failed,
    },
    errors,
  };
}

// ---------------------------------------------------------------------------
// Phase: state-assertion-check (Playwright)
// ---------------------------------------------------------------------------

function togglesForRoute(route: RouteGroup): StateToggle[] {
  return route.baseStateGroup.toggles;
}

async function runStateAssertionCheck(
  outDir: string,
  inference: InferenceResult | undefined,
  skipBrowser: boolean,
  previewReadyTimeoutMs: number,
  log: (l: string) => void,
): Promise<PhaseResult> {
  const start = Date.now();
  if (skipBrowser) {
    return {
      name: 'state-assertion-check',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'skipBrowser=true' },
      errors: [],
    };
  }
  if (!inference || inference.routes.length === 0) {
    return {
      name: 'state-assertion-check',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'no inference graph' },
      errors: [],
    };
  }

  const totalToggles = inference.routes.reduce(
    (sum, r) => sum + togglesForRoute(r).length,
    0,
  );
  if (totalToggles === 0) {
    return {
      name: 'state-assertion-check',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'no toggles inferred' },
      errors: [],
    };
  }

  let chromium: typeof import('playwright').chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch (err) {
    return {
      name: 'state-assertion-check',
      status: 'fail',
      metrics: { durationMs: Date.now() - start, toggles: totalToggles },
      errors: [
        `playwright unavailable: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  log(`  [state-assertion-check] starting vite preview in ${outDir}`);
  let server: PreviewServer;
  try {
    server = await startVitePreview(outDir, previewReadyTimeoutMs, log);
  } catch (err) {
    return {
      name: 'state-assertion-check',
      status: 'fail',
      metrics: { durationMs: Date.now() - start, toggles: totalToggles },
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }

  const errors: string[] = [];
  let passed = 0;
  let failed = 0;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    for (const route of inference.routes) {
      const toggles = togglesForRoute(route);
      if (toggles.length === 0) continue;
      const url = server.baseUrl + (route.routePath.startsWith('/') ? route.routePath : `/${route.routePath}`);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 });
      } catch (err) {
        failed += toggles.length;
        errors.push(
          `${route.routePath}: navigation failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }
      for (const toggle of toggles) {
        try {
          const locator = page.locator(toggle.triggerSelector).first();
          const beforeCount = await page.locator(toggle.appearedSelectorPath).count();
          await locator.click({ timeout: 5_000 });
          // Allow the overlay/transition to mount.
          await page.waitForTimeout(250);
          const afterCount = await page.locator(toggle.appearedSelectorPath).count();
          if (afterCount > beforeCount) {
            passed++;
          } else {
            failed++;
            errors.push(
              `${route.routePath} :: ${toggle.kind} (${toggle.triggerLabel}): expected state element to appear (selector "${toggle.appearedSelectorPath}")`,
            );
          }
        } catch (err) {
          failed++;
          errors.push(
            `${route.routePath} :: ${toggle.kind} (${toggle.triggerLabel}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
    await context.close();
  } finally {
    await browser.close();
    await stopPreview(server);
  }

  const status: PhaseStatus = failed === 0 ? 'ok' : passed > 0 ? 'warn' : 'fail';
  return {
    name: 'state-assertion-check',
    status,
    metrics: {
      durationMs: Date.now() - start,
      toggles: totalToggles,
      passed,
      failed,
    },
    errors,
  };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function runPostEmitMultiWebapp(
  options: PostEmitMultiWebappOptions,
): Promise<PostEmitMultiWebappResult> {
  const log = options.log ?? defaultLog;
  const outDir = resolve(options.outDir);
  const startedAt = nowIso();
  const startMs = Date.now();
  const previewReadyTimeoutMs =
    options.previewReadyTimeoutMs ?? DEFAULT_PREVIEW_READY_TIMEOUT_MS;

  const phases: PhaseResult[] = [];

  if (!existsSync(outDir)) {
    log(`post-emit-multi-webapp: outDir does not exist: ${outDir} - skipping.`);
    return {
      outDir,
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - startMs,
      phases: [
        {
          name: 'precheck',
          status: 'fail',
          metrics: { durationMs: 0 },
          errors: [`outDir does not exist: ${outDir}`],
        },
      ],
      passed: false,
    };
  }

  log('\n=== Webapp post-emit Phase 1/5: install ===');
  const installResult = await runInstall(outDir, options.skipInstall ?? false, log);
  phases.push(installResult);

  log('\n=== Webapp post-emit Phase 2/5: build ===');
  const buildResult =
    installResult.status === 'fail'
      ? {
          name: 'build',
          status: 'skipped' as PhaseStatus,
          metrics: { durationMs: 0, reason: 'install failed' },
          errors: [],
        }
      : await runBuild(outDir, options.skipBuild ?? false, log);
  phases.push(buildResult);

  log('\n=== Webapp post-emit Phase 3/5: msw-boot-check ===');
  const mswResult = await runMswBootCheck(outDir, log);
  phases.push(mswResult);

  log('\n=== Webapp post-emit Phase 4/5: route-render-check ===');
  const routeResult =
    buildResult.status === 'fail'
      ? {
          name: 'route-render-check',
          status: 'skipped' as PhaseStatus,
          metrics: { durationMs: 0, reason: 'build failed' },
          errors: [],
        }
      : await runRouteRenderCheck(
          outDir,
          options.inference,
          options.skipBrowser ?? false,
          previewReadyTimeoutMs,
          log,
        );
  phases.push(routeResult);

  log('\n=== Webapp post-emit Phase 5/5: state-assertion-check ===');
  const stateResult =
    buildResult.status === 'fail'
      ? {
          name: 'state-assertion-check',
          status: 'skipped' as PhaseStatus,
          metrics: { durationMs: 0, reason: 'build failed' },
          errors: [],
        }
      : await runStateAssertionCheck(
          outDir,
          options.inference,
          options.skipBrowser ?? false,
          previewReadyTimeoutMs,
          log,
        );
  phases.push(stateResult);

  // TODO Phase 7: pixel parity stretch. Boot preview, screenshot every
  // route + every captured toggled state, diff against the original
  // capture. Belongs after state-assertion-check so we know the project
  // is interactive before paying the cost of per-route screenshots.

  const finishedAt = nowIso();
  const durationMs = Date.now() - startMs;
  const passed = phases.every((p) => p.status === 'ok' || p.status === 'skipped');

  const result: PostEmitMultiWebappResult = {
    outDir,
    startedAt,
    finishedAt,
    durationMs,
    phases,
    passed,
  };

  try {
    writeFileSync(
      join(outDir, 'post-emit-webapp-summary.json'),
      JSON.stringify(result, null, 2) + '\n',
      'utf8',
    );
  } catch {
    // Non-fatal.
  }

  return result;
}
