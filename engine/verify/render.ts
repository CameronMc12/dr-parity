/**
 * Post-build render verification.
 *
 * Boots `npm run dev` inside an emitted Astro project, hits every page route
 * advertised in src/pages/*.astro, and asserts that the response renders
 * visible content. Catches the "build clean, page blank" regression that
 * a plain `astro build` cannot detect (e.g. the fluid.glass incident).
 */

import {
  existsSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import * as cheerio from 'cheerio';

export interface RouteResult {
  route: string;
  status: 'pass' | 'fail';
  httpStatus: number | null;
  bytes: number;
  reason: string | null;
}

export interface VerifyRenderReport {
  outDir: string;
  port: number | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  routesChecked: number;
  passed: number;
  failed: number;
  routes: RouteResult[];
  serverError: string | null;
}

export interface VerifyRenderOptions {
  /** Astro project root (must contain package.json + src/pages). */
  outDir: string;
  /** Max ms to wait for the dev server "ready" log. Default 30s. */
  readyTimeoutMs?: number;
  /** Min response bytes before failing a page. Default 500. */
  minBytes?: number;
  /** Optional log sink for progress lines. Defaults to process.stdout. */
  log?: (line: string) => void;
}

const READY_PATTERN = /(?:Local:\s+http:\/\/localhost:(\d+)|ready in \d+ms|astro\s+v[\d.]+ ready)/i;
const PORT_PATTERN = /http:\/\/localhost:(\d+)/i;
const DEFAULT_READY_TIMEOUT_MS = 30_000;
const DEFAULT_MIN_BYTES = 500;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Discover page routes from src/pages/*.astro.
 *
 * Maps file paths to URL routes using Astro conventions:
 *   src/pages/index.astro          -> /
 *   src/pages/about.astro          -> /about
 *   src/pages/collection/foo.astro -> /collection/foo
 */
export function discoverRoutes(outDir: string): string[] {
  const pagesDir = join(outDir, 'src', 'pages');
  if (!existsSync(pagesDir)) return [];
  const routes: string[] = [];
  const stack: string[] = [pagesDir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.endsWith('.astro')) continue;
      const rel = full.slice(pagesDir.length + 1).replace(/\\/g, '/');
      const noExt = rel.slice(0, -'.astro'.length);
      if (noExt === 'index') {
        routes.push('/');
      } else if (noExt.endsWith('/index')) {
        routes.push('/' + noExt.slice(0, -'/index'.length));
      } else {
        routes.push('/' + noExt);
      }
    }
  }
  // Stable order; root first.
  return routes.sort((a, b) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });
}

interface DevServer {
  child: ChildProcess;
  port: number;
}

function startDevServer(
  outDir: string,
  readyTimeoutMs: number,
  log: (line: string) => void,
): Promise<DevServer> {
  return new Promise((resolveServer, rejectServer) => {
    const child = spawn('npm', ['run', 'dev'], {
      cwd: outDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let resolved = false;
    let stdoutBuffer = '';
    let stderrBuffer = '';

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
          `dev server did not become ready within ${readyTimeoutMs}ms.\n` +
            `stdout tail: ${stdoutBuffer.slice(-400)}\n` +
            `stderr tail: ${stderrBuffer.slice(-400)}`,
        ),
      );
    }, readyTimeoutMs);

    const onData = (chunk: Buffer): void => {
      const text = chunk.toString('utf8');
      stdoutBuffer += text;
      log(text.replace(/\s+$/, ''));
      if (resolved) return;
      const portMatch = stdoutBuffer.match(PORT_PATTERN);
      const readyMatch = READY_PATTERN.test(stdoutBuffer);
      if (portMatch && readyMatch) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        // Re-attach a passthrough so background output is still flushed.
        child.stdout?.on('data', (c: Buffer) => log(c.toString('utf8').replace(/\s+$/, '')));
        child.stderr?.on('data', (c: Buffer) => log(c.toString('utf8').replace(/\s+$/, '')));
        resolveServer({ child, port: Number.parseInt(portMatch[1], 10) });
      }
    };

    const onErrData = (chunk: Buffer): void => {
      stderrBuffer += chunk.toString('utf8');
      onData(chunk);
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onErrData);
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
        new Error(`dev server exited before becoming ready (code ${code ?? 'null'})`),
      );
    });
  });
}

async function stopDevServer(server: DevServer): Promise<void> {
  if (server.child.killed || server.child.exitCode !== null) return;
  await new Promise<void>((resolveStop) => {
    const fallback = setTimeout(() => {
      try { server.child.kill('SIGKILL'); } catch { /* ignore */ }
      resolveStop();
    }, 5_000);
    server.child.once('exit', () => {
      clearTimeout(fallback);
      resolveStop();
    });
    try { server.child.kill('SIGTERM'); } catch { /* ignore */ resolveStop(); }
  });
}

async function fetchRoute(
  baseUrl: string,
  route: string,
): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = baseUrl + (route === '/' ? '/' : route);
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function evaluateBody(html: string, minBytes: number): { ok: boolean; reason: string | null } {
  if (!html || html.length === 0) {
    return { ok: false, reason: 'response empty' };
  }
  if (html.length < minBytes) {
    return { ok: false, reason: `response too small (${html.length} < ${minBytes} bytes)` };
  }
  const $ = cheerio.load(html);
  const body = $('body');
  if (body.length === 0) {
    return { ok: false, reason: '<body> missing' };
  }
  const bodyHtml = body.html() ?? '';
  if (bodyHtml.trim().length === 0) {
    return { ok: false, reason: '<body> empty' };
  }
  const bodyText = body.text().trim();
  const hasImg = body.find('img, picture, svg').length > 0;
  const nonEmptyDiv = body
    .find('div')
    .toArray()
    .some((el) => ($(el).text().trim().length > 0) || $(el).find('img,picture,svg,video,canvas').length > 0);
  if (bodyText.length > 0 || hasImg || nonEmptyDiv) {
    return { ok: true, reason: null };
  }
  return { ok: false, reason: '<body> has no visible content' };
}

export async function verifyRender(
  options: VerifyRenderOptions,
): Promise<VerifyRenderReport> {
  const outDir = options.outDir;
  const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
  const minBytes = options.minBytes ?? DEFAULT_MIN_BYTES;
  const log = options.log ?? ((line) => { process.stdout.write(line + '\n'); });
  const startedAt = new Date();

  if (!existsSync(outDir)) {
    throw new Error(`verifyRender: outDir does not exist: ${outDir}`);
  }
  if (!existsSync(join(outDir, 'package.json'))) {
    throw new Error(`verifyRender: outDir is not an Astro project (no package.json): ${outDir}`);
  }

  const routes = discoverRoutes(outDir);
  if (routes.length === 0) {
    const finishedAt = new Date();
    const report: VerifyRenderReport = {
      outDir,
      port: null,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      routesChecked: 0,
      passed: 0,
      failed: 0,
      routes: [],
      serverError: 'no routes found under src/pages',
    };
    writeReportFile(outDir, report);
    return report;
  }

  log(`verify-render: starting dev server in ${outDir}`);
  let server: DevServer;
  try {
    server = await startDevServer(outDir, readyTimeoutMs, log);
  } catch (err) {
    const finishedAt = new Date();
    const report: VerifyRenderReport = {
      outDir,
      port: null,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      routesChecked: 0,
      passed: 0,
      failed: 0,
      routes: [],
      serverError: err instanceof Error ? err.message : String(err),
    };
    writeReportFile(outDir, report);
    return report;
  }

  const baseUrl = `http://localhost:${server.port}`;
  log(`verify-render: server ready on ${baseUrl}, checking ${routes.length} routes`);

  const results: RouteResult[] = [];
  try {
    for (const route of routes) {
      try {
        const { status, body } = await fetchRoute(baseUrl, route);
        const evalResult = evaluateBody(body, minBytes);
        const passed = status >= 200 && status < 400 && evalResult.ok;
        const reason = !passed
          ? evalResult.reason ?? `http ${status}`
          : null;
        results.push({
          route,
          status: passed ? 'pass' : 'fail',
          httpStatus: status,
          bytes: body.length,
          reason,
        });
        log(`  ${passed ? 'PASS' : 'FAIL'}  ${route}  (${status}, ${body.length}b)${reason ? `  -- ${reason}` : ''}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          route,
          status: 'fail',
          httpStatus: null,
          bytes: 0,
          reason: `fetch error: ${msg}`,
        });
        log(`  FAIL  ${route}  -- fetch error: ${msg}`);
      }
    }
  } finally {
    await stopDevServer(server);
  }

  const finishedAt = new Date();
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.length - passed;
  const report: VerifyRenderReport = {
    outDir,
    port: server.port,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    routesChecked: results.length,
    passed,
    failed,
    routes: results,
    serverError: null,
  };
  writeReportFile(outDir, report);
  return report;
}

function writeReportFile(outDir: string, report: VerifyRenderReport): void {
  const reportPath = join(outDir, 'verify-render-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}
