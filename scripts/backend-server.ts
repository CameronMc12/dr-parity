#!/usr/bin/env tsx
/**
 * OWNED local backend server for the ClickUp replay.
 *
 * Serves the bundle's internal-shape READ endpoints from the user's real export
 * data via the handler chain, so the replayed Angular bundle works as a live app
 * offline. Every request is logged to a coverage log and tagged `x-backend:
 * live|miss`. Unhandled internal calls return empty-200 (the app stays alive) and
 * are counted as gaps.
 *
 * Built on Node's `http` (no express dependency). CORS is fully open because the
 * replay's Service Worker forwards cross-origin frontdoor-host requests here from
 * a different origin.
 *
 * Usage:
 *   npm run backend                       (port 8787, default store + crawl)
 *   npm run backend -- --port=8787 --store=<store.json> --crawl-dir=<dir>
 *   GET /__coverage  -> JSON coverage summary (for the harness)
 *   POST /__coverage/reset -> clear counters
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isAbsolute, resolve } from 'node:path';

import { JsonStore } from '../engine/targets/webapp/backend/json-store';
import { loadTemplates } from '../engine/targets/webapp/backend/templates-cache';
import { routeRequest } from '../engine/targets/webapp/backend/router';
import { CoverageLog } from '../engine/targets/webapp/backend/coverage';
import type { RequestCtx } from '../engine/targets/webapp/backend/handlers';

const DEFAULT_PORT = 8787;
const DEFAULT_STORE = '.runs/backend/store.json';
const DEFAULT_CRAWL = 'docs/research/crawl/app.clickup.com/2026-05-25T16-33-12-057Z';

type Args = { port: number; storePath: string; crawlDir: string };

function parseArgs(argv: string[]): Args {
  let port = DEFAULT_PORT;
  let storePath = DEFAULT_STORE;
  let crawlDir = DEFAULT_CRAWL;
  for (const raw of argv) {
    if (raw.startsWith('--port=')) port = Number(raw.slice('--port='.length)) || DEFAULT_PORT;
    else if (raw.startsWith('--store=')) storePath = raw.slice('--store='.length);
    else if (raw.startsWith('--crawl-dir=')) crawlDir = raw.slice('--crawl-dir='.length);
  }
  return {
    port,
    storePath: isAbsolute(storePath) ? storePath : resolve(storePath),
    crawlDir: isAbsolute(crawlDir) ? crawlDir : resolve(crawlDir),
  };
}

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'x-backend,x-backend-handler',
  'access-control-max-age': '86400',
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolveBody(''));
  });
}

function parseJsonBody(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const store = JsonStore.fromFile(args.storePath);
  process.stdout.write(`Loading captured templates from crawl (one-time stream)...\n`);
  const templates = await loadTemplates(args.crawlDir);
  const haveTemplates = [
    templates.subcategory ? 'subcategory' : null,
    templates.genericView ? 'genericView' : null,
    templates.tasksBulk ? 'tasksBulk' : null,
    templates.sidebarTree ? 'sidebarTree' : null,
    templates.project ? 'project' : null,
  ].filter(Boolean);
  const coverage = new CoverageLog();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = (req.method ?? 'GET').toUpperCase();
    const url = new URL(req.url ?? '/', `http://localhost:${args.port}`);

    if (method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // Coverage introspection endpoints (not part of the ClickUp API surface).
    if (url.pathname === '/__coverage' && method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify(coverage.summary()));
      return;
    }
    if (url.pathname === '/__coverage/reset' && method === 'POST') {
      coverage.reset();
      res.writeHead(200, { 'content-type': 'application/json', ...CORS_HEADERS });
      res.end('{"ok":true}');
      return;
    }
    if (url.pathname === '/__health') {
      res.writeHead(200, { 'content-type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ ok: true, templates: haveTemplates, lists: store.lists().length }));
      return;
    }

    const rawBody = method === 'GET' || method === 'HEAD' ? '' : await readBody(req);
    const ctx: RequestCtx = {
      method,
      pathname: url.pathname,
      segments: url.pathname.split('/').filter(Boolean),
      query: url.searchParams,
      body: parseJsonBody(rawBody),
    };

    const routed = routeRequest(ctx, store, templates, coverage);
    res.writeHead(routed.status, { ...routed.headers, ...CORS_HEADERS });
    res.end(routed.body);
  }

  server.listen(args.port, () => {
    process.stdout.write(
      `OWNED ClickUp backend listening on http://localhost:${args.port}\n` +
        `  store:     ${args.storePath} (${store.lists().length} lists, ${store.allTasks().length} tasks)\n` +
        `  templates: ${haveTemplates.join(', ') || 'NONE (list render will miss)'}\n` +
        `  coverage:  GET /__coverage\n`,
    );
  });
}

main().catch((err) => {
  process.stderr.write(`backend-server failed: ${(err as Error).message}\n`);
  process.exit(1);
});
