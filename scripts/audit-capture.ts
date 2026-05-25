#!/usr/bin/env tsx
/**
 * Audit Capture Pipeline — deterministic three-phase capture for SPA web apps.
 *
 * Replaces the BFS crawler with a plan-then-execute model that captures every
 * interactive surface exactly once. Three phases:
 *
 *   1. shell    — visit each known route, dump hydrated HTML + computed styles
 *                 + screenshot + HAR + meta.
 *   2. plan     — cheerio-parse each shell.html and emit a plan.json listing
 *                 every interactive surface (buttons, links, role=menuitem,
 *                 aria-haspopup, data-state, etc.) with selector + blocklist
 *                 verdict.
 *   3. execute  — for each unblocked plan entry, navigate, perform the action,
 *                 capture before/after screenshots, after.html, delta-network,
 *                 and meta. Reload between entries for isolation.
 *
 * Subcommands:
 *   tsx scripts/audit-capture.ts shell    <startUrl> [--routes=<csv>] [--out=<dir>]
 *   tsx scripts/audit-capture.ts plan     <auditDir>
 *   tsx scripts/audit-capture.ts execute  <auditDir> [--blocklist=<path>]
 *   tsx scripts/audit-capture.ts run      <startUrl> [--routes=<csv>] [--out=<dir>] [--blocklist=<path>]
 *
 * Auth: reuses the persistent profile at ~/.config/playwright-pinterest
 * (same as scripts/login-omni.ts and scripts/auth-verify.ts).
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { chromium, type BrowserContext, type Page, type Request, type Response, type Locator } from 'playwright';
import * as cheerio from 'cheerio';
import type { AnyNode, Element as DomElement } from 'domhandler';
import { isBlocked, ALWAYS_BLOCKED_TEXT, type BlocklistInput } from '../engine/targets/webapp/crawler/blocklist';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Action = 'click' | 'hover' | 'navigate';

export type PlanEntry = {
  id: string;
  route: string;
  selector: string;
  label: string;
  tagName: string;
  ariaLabel: string | null;
  ariaHaspopup: string | null;
  role: string | null;
  dataState: string | null;
  action: Action;
  hrefTarget: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
};

type RouteMeta = {
  route: string;
  slug: string;
  finalUrl: string;
  title: string;
  viewport: { width: number; height: number };
  timestamp: string;
};

type ExecutionRecord = {
  entryId: string;
  route: string;
  label: string;
  selector: string;
  status: 'success' | 'element-missing' | 'timeout' | 'error' | 'blocked';
  errorMessage?: string;
  timestamp: string;
};

type AuditSummary = {
  startUrl: string;
  host: string;
  timestamp: string;
  routes: string[];
  planStats: {
    totalEntries: number;
    blockedCount: number;
    unblockedCount: number;
  } | null;
  executionStats: {
    success: number;
    elementMissing: number;
    timeout: number;
    error: number;
    blocked: number;
  } | null;
  executions: ExecutionRecord[];
};

type NetworkEvent = {
  url: string;
  method: string;
  status: number | null;
  mimeType: string | null;
  resourceType: string;
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_DATA_DIR = join(homedir(), '.config', 'playwright-pinterest');
const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_ROUTES = ['/', '/posts', '/social-inbox', '/analytics', '/reviews', '/workflows', '/approval', '/link-in-bio', '/library'];
const SETTLE_MS = 2000;
const ACTION_WAIT_MS = 1500;
const NAV_TIMEOUT_MS = 30_000;

// CSS properties to capture in computed-styles snapshot.
const STYLE_PROPS: readonly string[] = [
  'fontSize',
  'fontFamily',
  'fontWeight',
  'lineHeight',
  'color',
  'backgroundColor',
  'padding',
  'margin',
  'borderRadius',
  'border',
  'display',
  'position',
  'width',
  'height',
  'opacity',
  'boxShadow',
];

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [, , subcommand, ...rest] = process.argv;

  if (!subcommand || ['-h', '--help', 'help'].includes(subcommand)) {
    printHelp();
    return;
  }

  const args = parseArgs(rest);

  switch (subcommand) {
    case 'shell': {
      const startUrl = args.positional[0];
      if (!startUrl) throw new Error('shell: <startUrl> is required');
      await runShellPhase(startUrl, args);
      return;
    }
    case 'plan': {
      const auditDir = args.positional[0];
      if (!auditDir) throw new Error('plan: <auditDir> is required');
      await runPlanPhase(resolve(auditDir));
      return;
    }
    case 'execute': {
      const auditDir = args.positional[0];
      if (!auditDir) throw new Error('execute: <auditDir> is required');
      await runExecutePhase(resolve(auditDir), args.blocklist);
      return;
    }
    case 'run': {
      const startUrl = args.positional[0];
      if (!startUrl) throw new Error('run: <startUrl> is required');
      const auditDir = await runShellPhase(startUrl, args);
      await runPlanPhase(auditDir);
      await runExecutePhase(auditDir, args.blocklist);
      return;
    }
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

function printHelp(): void {
  process.stdout.write(
    [
      'audit-capture — deterministic three-phase web app capture',
      '',
      'Usage:',
      '  tsx scripts/audit-capture.ts shell    <startUrl> [--routes=<csv>] [--out=<dir>]',
      '  tsx scripts/audit-capture.ts plan     <auditDir>',
      '  tsx scripts/audit-capture.ts execute  <auditDir> [--blocklist=<path>]',
      '  tsx scripts/audit-capture.ts run      <startUrl> [--routes=<csv>] [--out=<dir>] [--blocklist=<path>]',
      '',
    ].join('\n'),
  );
}

type CliArgs = {
  positional: string[];
  routes: string[] | null;
  out: string | null;
  blocklist: string | null;
};

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let routes: string[] | null = null;
  let out: string | null = null;
  let blocklist: string | null = null;

  for (const arg of argv) {
    if (arg.startsWith('--routes=')) {
      routes = arg
        .slice('--routes='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    } else if (arg.startsWith('--blocklist=')) {
      blocklist = arg.slice('--blocklist='.length);
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return { positional, routes, out, blocklist };
}

// ---------------------------------------------------------------------------
// Phase 1: shell capture
// ---------------------------------------------------------------------------

async function runShellPhase(startUrl: string, args: CliArgs): Promise<string> {
  const host = new URL(startUrl).host;
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const outRoot = args.out
    ? resolve(args.out)
    : resolve(process.cwd(), 'docs', 'research', 'audit', host, iso);
  mkdirSync(outRoot, { recursive: true });
  mkdirSync(join(outRoot, 'routes'), { recursive: true });

  const routes = args.routes ?? DEFAULT_ROUTES;
  process.stdout.write(`[shell] target=${startUrl} out=${outRoot} routes=${routes.length}\n`);

  const context = await openContext();

  try {
    for (const route of routes) {
      await captureRouteShell(context, startUrl, route, outRoot);
    }
  } finally {
    await context.close();
  }

  const summary: AuditSummary = {
    startUrl,
    host,
    timestamp: iso,
    routes,
    planStats: null,
    executionStats: null,
    executions: [],
  };
  writeFileSync(join(outRoot, 'audit-summary.json'), JSON.stringify(summary, null, 2));

  process.stdout.write(`[shell] done → ${outRoot}\n`);
  return outRoot;
}

async function openContext(): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: true,
    viewport: DEFAULT_VIEWPORT,
    bypassCSP: true,
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  await context.addInitScript(() => {
    if (typeof (globalThis as unknown as { __name?: unknown }).__name === 'undefined') {
      (globalThis as unknown as { __name: (fn: unknown) => unknown }).__name = (fn: unknown) => fn;
    }
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch {
      /* noop */
    }
  });
  return context;
}

async function captureRouteShell(
  context: BrowserContext,
  startUrl: string,
  route: string,
  outRoot: string,
): Promise<void> {
  const slug = slugifyRoute(route);
  const routeDir = join(outRoot, 'routes', slug);
  mkdirSync(routeDir, { recursive: true });

  const fullUrl = new URL(route, startUrl).toString();
  process.stdout.write(`[shell] capturing ${route} → ${slug}\n`);

  // Manual network capture (HAR-like) — avoids needing recordHar per context.
  const events: NetworkEvent[] = [];
  const page = await context.newPage();
  const onRequest = (req: Request): void => {
    events.push({
      url: req.url(),
      method: req.method(),
      status: null,
      mimeType: null,
      resourceType: req.resourceType(),
      timestamp: Date.now(),
    });
  };
  const onResponse = (res: Response): void => {
    const url = res.url();
    const last = [...events].reverse().find((e) => e.url === url && e.status === null);
    if (last) {
      last.status = res.status();
      const ct = res.headers()['content-type'] ?? null;
      last.mimeType = ct ? ct.split(';')[0] : null;
    }
  };
  page.on('request', onRequest);
  page.on('response', onResponse);

  try {
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
    await page.waitForTimeout(SETTLE_MS);

    const finalUrl = page.url();
    const title = await page.title();

    const html = await page.content();
    writeFileSync(join(routeDir, 'shell.html'), html);

    const styles = await captureComputedStyles(page);
    writeFileSync(join(routeDir, 'computed-styles.json'), JSON.stringify(styles, null, 2));

    await page.screenshot({ path: join(routeDir, 'screenshot.png'), fullPage: true });

    writeFileSync(
      join(routeDir, 'network.har'),
      JSON.stringify(eventsToHar(events, finalUrl), null, 2),
    );

    const meta: RouteMeta = {
      route,
      slug,
      finalUrl,
      title,
      viewport: DEFAULT_VIEWPORT,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(join(routeDir, 'meta.json'), JSON.stringify(meta, null, 2));
  } catch (err) {
    process.stderr.write(`[shell] failed ${route}: ${(err as Error).message}\n`);
    writeFileSync(
      join(routeDir, 'error.json'),
      JSON.stringify({ message: (err as Error).message, route, fullUrl }, null, 2),
    );
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
    await page.close().catch(() => {});
  }
}

// Capture computed styles that differ from a fresh detached reference element
// per tag. Inline implementation (not borrowed from page-scanner) because we
// only need the minimal style snapshot the audit summary cares about.
async function captureComputedStyles(page: Page): Promise<Array<Record<string, unknown>>> {
  const props = STYLE_PROPS as unknown as string[];
  const result = await page.evaluate((styleProps: string[]): Array<Record<string, unknown>> => {
    if (typeof (globalThis as unknown as { __name?: unknown }).__name === 'undefined') {
      (globalThis as unknown as { __name: (fn: unknown) => unknown }).__name = (fn: unknown) => fn;
    }
    const referenceCache = new Map<string, Record<string, string>>();
    const cssEscape = (s: string): string => {
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
      return s.replace(/(["\\#.:>+~()[\]])/g, '\\$1');
    };
    const cssCase = (prop: string): string => {
      return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    };
    const getReference = (tag: string): Record<string, string> => {
      const cached = referenceCache.get(tag);
      if (cached) return cached;
      const ref = document.createElement(tag);
      Object.assign(ref.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' });
      document.body.appendChild(ref);
      const cs = window.getComputedStyle(ref);
      const snap: Record<string, string> = {};
      for (const p of styleProps) snap[p] = cs.getPropertyValue(cssCase(p)) || cs[p as keyof CSSStyleDeclaration]?.toString() || '';
      ref.remove();
      referenceCache.set(tag, snap);
      return snap;
    };
    const isVisible = (el: Element): boolean => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      return true;
    };
    const buildSelector = (el: Element): string => {
      const id = el.getAttribute('id');
      if (id) return `#${cssEscape(id)}`;
      const aria = el.getAttribute('aria-label');
      if (aria) return `${el.tagName.toLowerCase()}[aria-label="${cssEscape(aria)}"]`;
      const testid = el.getAttribute('data-testid');
      if (testid) return `[data-testid="${cssEscape(testid)}"]`;
      const parts: string[] = [];
      let cur: Element | null = el;
      let depth = 0;
      while (cur && cur !== document.documentElement && depth < 6) {
        const parent: Element | null = cur.parentElement;
        if (!parent) break;
        const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
        const idx = same.indexOf(cur) + 1;
        parts.unshift(`${cur.tagName.toLowerCase()}:nth-of-type(${idx})`);
        cur = parent;
        depth += 1;
      }
      return parts.join(' > ');
    };

    const out: Array<Record<string, unknown>> = [];
    const all = document.querySelectorAll<HTMLElement>('body *');
    let captured = 0;
    const MAX = 2500;
    for (const el of Array.from(all)) {
      if (captured >= MAX) break;
      if (!isVisible(el)) continue;
      const tag = el.tagName.toLowerCase();
      const ref = getReference(tag);
      const cs = window.getComputedStyle(el);
      const diff: Record<string, string> = {};
      for (const p of styleProps) {
        const key = cssCase(p);
        const value = cs.getPropertyValue(key);
        if (value && value !== ref[p]) diff[p] = value;
      }
      if (Object.keys(diff).length === 0) continue;
      out.push({ selector: buildSelector(el), tag, styles: diff });
      captured += 1;
    }
    return out;
  }, props);
  return result;
}

function eventsToHar(events: NetworkEvent[], pageUrl: string): unknown {
  return {
    log: {
      version: '1.2',
      creator: { name: 'audit-capture', version: '1.0' },
      pages: [
        {
          startedDateTime: new Date().toISOString(),
          id: 'page_0',
          title: pageUrl,
          pageTimings: { onContentLoad: -1, onLoad: -1 },
        },
      ],
      entries: events.map((e) => ({
        startedDateTime: new Date(e.timestamp).toISOString(),
        pageref: 'page_0',
        request: { method: e.method, url: e.url, headers: [], queryString: [], cookies: [], headersSize: -1, bodySize: -1 },
        response: {
          status: e.status ?? 0,
          statusText: '',
          headers: [],
          cookies: [],
          content: { size: -1, mimeType: e.mimeType ?? '', text: '' },
          redirectURL: '',
          headersSize: -1,
          bodySize: -1,
          _resourceType: e.resourceType,
        },
        cache: {},
        timings: { send: 0, wait: 0, receive: 0 },
      })),
    },
  };
}

function slugifyRoute(route: string): string {
  const trimmed = route.replace(/^\/+|\/+$/g, '');
  if (trimmed === '') return 'root';
  return trimmed.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

// ---------------------------------------------------------------------------
// Phase 2: plan generation
// ---------------------------------------------------------------------------

async function runPlanPhase(auditDir: string): Promise<void> {
  const routesDir = join(auditDir, 'routes');
  if (!existsSync(routesDir)) throw new Error(`Routes dir not found: ${routesDir}`);

  const slugs = readdirSync(routesDir).filter((s) => {
    const p = join(routesDir, s);
    return statSync(p).isDirectory() && existsSync(join(p, 'shell.html'));
  });

  let totalEntries = 0;
  let blockedCount = 0;
  const allPlans: Array<{ slug: string; entries: PlanEntry[] }> = [];

  for (const slug of slugs) {
    const routeDir = join(routesDir, slug);
    const html = readFileSync(join(routeDir, 'shell.html'), 'utf8');
    const meta = JSON.parse(readFileSync(join(routeDir, 'meta.json'), 'utf8')) as RouteMeta;
    const entries = buildPlanForRoute(html, meta.route, slug);

    writeFileSync(join(routeDir, 'plan.json'), JSON.stringify(entries, null, 2));
    totalEntries += entries.length;
    blockedCount += entries.filter((e) => e.isBlocked).length;
    allPlans.push({ slug, entries });

    process.stdout.write(
      `[plan] ${slug}: ${entries.length} entries (${entries.filter((e) => !e.isBlocked).length} unblocked)\n`,
    );
  }

  // Update summary
  const summaryPath = join(auditDir, 'audit-summary.json');
  const summary: AuditSummary = existsSync(summaryPath)
    ? JSON.parse(readFileSync(summaryPath, 'utf8'))
    : {
        startUrl: '',
        host: '',
        timestamp: new Date().toISOString(),
        routes: [],
        planStats: null,
        executionStats: null,
        executions: [],
      };
  summary.planStats = {
    totalEntries,
    blockedCount,
    unblockedCount: totalEntries - blockedCount,
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  process.stdout.write(
    `[plan] done → ${allPlans.length} routes, ${totalEntries} entries, ${blockedCount} blocked\n`,
  );
}

function buildPlanForRoute(html: string, route: string, slug: string): PlanEntry[] {
  const $ = cheerio.load(html);
  const entries: PlanEntry[] = [];
  const seenSelectors = new Set<string>();

  const selector = [
    'button',
    'a[href]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="option"]',
    '[role="button"]',
    '[role="combobox"]',
    'select',
    'summary',
    '[aria-haspopup="true"]',
    '[aria-haspopup="menu"]',
    '[aria-haspopup="dialog"]',
    '[aria-haspopup="listbox"]',
    '[data-state]',
    '[onclick]',
  ].join(', ');

  $(selector).each((_idx, el) => {
    if (el.type !== 'tag') return;
    const elTag = el as DomElement;
    const $el = $(elTag);
    const tagName = elTag.name.toLowerCase();
    if (!tagName) return;

    // Skip hidden via inline attrs (cheerio doesn't see computed CSS).
    const ariaHidden = $el.attr('aria-hidden');
    if (ariaHidden === 'true') return;
    const inlineStyle = $el.attr('style') ?? '';
    if (/display\s*:\s*none/i.test(inlineStyle) || /visibility\s*:\s*hidden/i.test(inlineStyle)) return;

    const ariaLabel = $el.attr('aria-label') ?? null;
    const role = $el.attr('role') ?? null;
    const dataState = $el.attr('data-state') ?? null;
    const ariaHaspopup = $el.attr('aria-haspopup') ?? null;
    const href = $el.attr('href') ?? null;
    const type = $el.attr('type') ?? null;
    const className = $el.attr('class') ?? null;
    const text = ($el.text() ?? '').replace(/\s+/g, ' ').trim();
    const title = $el.attr('title') ?? null;
    const label = (ariaLabel || text || title || tagName).slice(0, 200);

    // Skip external anchors.
    if (tagName === 'a' && href) {
      if (/^(https?:)?\/\//i.test(href) && !href.includes(route)) {
        // External link to a different host or different app — skip in plan.
        // We can't fully resolve without origin, so be conservative: only keep
        // anchors whose href is relative or hash.
        if (!/^\.\.?\//.test(href) && !href.startsWith('/') && !href.startsWith('#')) return;
      }
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    }

    const action: Action = tagName === 'a' && href ? 'navigate' : 'click';
    const sel = buildCheerioSelector($, $el, elTag);
    if (!sel || seenSelectors.has(sel)) return;
    seenSelectors.add(sel);

    const ancestorClasses: string[] = [];
    $el.parents().each((__i, p) => {
      const pc = $(p).attr('class');
      if (pc) ancestorClasses.push(pc);
    });

    const blocklistInput: BlocklistInput = {
      text: text || null,
      ariaLabel,
      className,
      type,
      insideForm: $el.parents('form').length > 0,
      ancestorClasses,
    };
    const blocked = isBlocked(blocklistInput, []);
    const blockedReason = blocked ? deriveBlockedReason(blocklistInput) : null;

    const id = `${slug}-${sha8(`${route}|${sel}`)}`;

    entries.push({
      id,
      route,
      selector: sel,
      label,
      tagName,
      ariaLabel,
      ariaHaspopup,
      role,
      dataState,
      action,
      hrefTarget: href,
      isBlocked: blocked,
      blockedReason,
    });
  });

  return entries;
}

function deriveBlockedReason(input: BlocklistInput): string {
  const haystacks = [input.text ?? '', input.ariaLabel ?? ''].map((s) => s.toLowerCase());
  for (const phrase of ALWAYS_BLOCKED_TEXT) {
    if (haystacks.some((h) => h.includes(phrase))) return `text-match:${phrase}`;
  }
  if (input.className && /\b(destructive|danger|delete|trash)\b/i.test(input.className)) {
    return 'danger-class';
  }
  for (const c of input.ancestorClasses) {
    if (/\b(destructive|danger|delete|trash)\b/i.test(c)) return 'ancestor-danger-class';
  }
  if (input.type === 'submit' && input.insideForm) return 'form-submit';
  return 'unknown';
}

function buildCheerioSelector(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<DomElement>,
  el: DomElement,
): string | null {
  const tag = el.name.toLowerCase();

  const ariaLabel = $el.attr('aria-label');
  if (ariaLabel) {
    const sel = `${tag}[aria-label="${cssEscape(ariaLabel)}"]`;
    if ($(sel).length === 1) return sel;
  }

  const id = $el.attr('id');
  if (id) {
    const sel = `#${cssEscape(id)}`;
    if ($(sel).length === 1) return sel;
  }

  const testid = $el.attr('data-testid');
  if (testid) {
    const sel = `[data-testid="${cssEscape(testid)}"]`;
    if ($(sel).length === 1) return sel;
  }

  // nth-of-type chain
  const parts: string[] = [];
  let cur: AnyNode | null = el;
  let depth = 0;
  while (cur && depth < 8) {
    if (cur.type !== 'tag') break;
    const node = cur as DomElement;
    const parent: AnyNode | null = (node.parent as AnyNode | null) ?? null;
    if (!parent || parent.type !== 'tag') break;
    const parentEl = parent as DomElement;
    const siblings = parentEl.children.filter(
      (c): c is DomElement => c.type === 'tag' && (c as DomElement).name === node.name,
    );
    const idx = siblings.indexOf(node) + 1;
    parts.unshift(`${node.name.toLowerCase()}:nth-of-type(${idx})`);
    cur = parent;
    depth += 1;
  }
  const positional = parts.join(' > ');
  if (positional) {
    if ($(positional).length === 1) return positional;
    // Fall through to text-based fallback.
  }

  // Text-based fallback (cheerio supports :contains).
  const text = $el.text().replace(/\s+/g, ' ').trim().slice(0, 40);
  if (text) {
    const sel = `${tag}:contains("${text.replace(/"/g, '\\"')}")`;
    if ($(sel).length === 1) return sel;
  }

  return positional || null;
}

function cssEscape(s: string): string {
  return s.replace(/(["\\#.:>+~()[\]])/g, '\\$1');
}

function sha8(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

// ---------------------------------------------------------------------------
// Phase 3: execute
// ---------------------------------------------------------------------------

async function runExecutePhase(auditDir: string, blocklistPath: string | null): Promise<void> {
  const routesDir = join(auditDir, 'routes');
  const statesDir = join(auditDir, 'states');
  mkdirSync(statesDir, { recursive: true });

  const summaryPath = join(auditDir, 'audit-summary.json');
  const summary: AuditSummary = existsSync(summaryPath)
    ? JSON.parse(readFileSync(summaryPath, 'utf8'))
    : {
        startUrl: '',
        host: '',
        timestamp: new Date().toISOString(),
        routes: [],
        planStats: null,
        executionStats: null,
        executions: [],
      };

  const extraPatterns = loadExtraBlocklist(blocklistPath);

  const slugs = readdirSync(routesDir).filter((s) => {
    const p = join(routesDir, s);
    return statSync(p).isDirectory() && existsSync(join(p, 'plan.json'));
  });

  const startUrl = summary.startUrl || deriveStartUrlFromMeta(routesDir, slugs);
  if (!startUrl) throw new Error('Cannot derive startUrl — provide audit-summary.json or routes/<slug>/meta.json');

  const context = await openContext();
  const stats = { success: 0, elementMissing: 0, timeout: 0, error: 0, blocked: 0 };
  const records: ExecutionRecord[] = [];

  try {
    for (const slug of slugs) {
      const routeDir = join(routesDir, slug);
      const plan = JSON.parse(readFileSync(join(routeDir, 'plan.json'), 'utf8')) as PlanEntry[];
      const meta = JSON.parse(readFileSync(join(routeDir, 'meta.json'), 'utf8')) as RouteMeta;
      process.stdout.write(`[execute] ${slug}: ${plan.length} entries\n`);

      for (const entry of plan) {
        const augmentedBlocked = entry.isBlocked || isExtraBlocked(entry, extraPatterns);
        if (augmentedBlocked) {
          stats.blocked += 1;
          records.push({
            entryId: entry.id,
            route: entry.route,
            label: entry.label,
            selector: entry.selector,
            status: 'blocked',
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        const record = await executeEntry(context, startUrl, meta, entry, statesDir);
        records.push(record);
        switch (record.status) {
          case 'success':
            stats.success += 1;
            break;
          case 'element-missing':
            stats.elementMissing += 1;
            break;
          case 'timeout':
            stats.timeout += 1;
            break;
          case 'error':
            stats.error += 1;
            break;
        }
      }
    }
  } finally {
    await context.close();
  }

  summary.executionStats = stats;
  summary.executions = records;
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  process.stdout.write(
    `[execute] done — success=${stats.success} missing=${stats.elementMissing} timeout=${stats.timeout} error=${stats.error} blocked=${stats.blocked}\n`,
  );
}

function deriveStartUrlFromMeta(routesDir: string, slugs: string[]): string | null {
  for (const slug of slugs) {
    const metaPath = join(routesDir, slug, 'meta.json');
    if (!existsSync(metaPath)) continue;
    const m = JSON.parse(readFileSync(metaPath, 'utf8')) as RouteMeta;
    try {
      const u = new URL(m.finalUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* noop */
    }
  }
  return null;
}

function loadExtraBlocklist(path: string | null): string[] {
  if (!path) return [];
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    process.stderr.write(`[execute] blocklist not found: ${resolved}\n`);
    return [];
  }
  const lines = readFileSync(resolved, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  return lines;
}

function isExtraBlocked(entry: PlanEntry, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const haystacks = [entry.label, entry.ariaLabel ?? ''].map((s) => s.toLowerCase());
  for (const p of patterns) {
    const lower = p.toLowerCase();
    if (haystacks.some((h) => h.includes(lower))) return true;
  }
  return false;
}

const GENERIC_LABELS = new Set(['button', 'div', 'span', 'a', 'svg', 'img', 'icon', '']);

async function tryLocator(loc: Locator): Promise<Locator | null> {
  try {
    const n = await loc.count();
    if (n === 0) return null;
    return loc.first();
  } catch {
    return null;
  }
}

async function resolveLocator(page: Page, entry: PlanEntry): Promise<Locator | null> {
  if (entry.ariaLabel) {
    const esc = entry.ariaLabel.replace(/"/g, '\\"');
    const r = await tryLocator(page.locator(`[aria-label="${esc}"]`));
    if (r) return r;
  }
  const label = (entry.label ?? '').trim();
  const labelIsGeneric = GENERIC_LABELS.has(label.toLowerCase()) || label.length === 0;
  if (!labelIsGeneric) {
    if (entry.role) {
      const allowedRoles = new Set([
        'button','link','menuitem','tab','option','combobox','checkbox','radio','switch','listbox','dialog','menu','menubar',
      ]);
      if (allowedRoles.has(entry.role)) {
        const r = await tryLocator(
          page.getByRole(entry.role as Parameters<Page['getByRole']>[0], { name: label, exact: true }),
        );
        if (r) return r;
      }
    }
    const tag = (entry.tagName ?? '').toLowerCase();
    const safeLabel = label.slice(0, 60).replace(/"/g, '\\"');
    if (tag) {
      const r = await tryLocator(page.locator(`${tag}:has-text("${safeLabel}")`));
      if (r) return r;
    }
    const r = await tryLocator(page.getByText(label, { exact: true }));
    if (r) return r;
  }
  const sel = entry.selector ?? '';
  if (sel && !sel.includes('radix-')) {
    const r = await tryLocator(page.locator(sel));
    if (r) return r;
  }
  return null;
}

async function executeEntry(
  context: BrowserContext,
  startUrl: string,
  meta: RouteMeta,
  entry: PlanEntry,
  statesDir: string,
): Promise<ExecutionRecord> {
  const stateDir = join(statesDir, `${slugifyRoute(entry.route)}__${entry.id}`);
  mkdirSync(stateDir, { recursive: true });

  if (existsSync(join(stateDir, 'after.html'))) {
    return {
      entryId: entry.id,
      route: entry.route,
      label: entry.label,
      selector: entry.selector,
      status: 'success',
      timestamp: new Date().toISOString(),
    };
  }

  const fullUrl = new URL(entry.route, startUrl).toString();
  const events: NetworkEvent[] = [];
  const page = await context.newPage();
  const onRequest = (req: Request): void => {
    events.push({
      url: req.url(),
      method: req.method(),
      status: null,
      mimeType: null,
      resourceType: req.resourceType(),
      timestamp: Date.now(),
    });
  };
  const onResponse = (res: Response): void => {
    const url = res.url();
    const last = [...events].reverse().find((e) => e.url === url && e.status === null);
    if (last) {
      last.status = res.status();
      const ct = res.headers()['content-type'] ?? null;
      last.mimeType = ct ? ct.split(';')[0] : null;
    }
  };

  try {
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
    await page.waitForTimeout(SETTLE_MS);

    const locator = await resolveLocator(page, entry);
    if (!locator) {
      return {
        entryId: entry.id,
        route: entry.route,
        label: entry.label,
        selector: entry.selector,
        status: 'element-missing',
        timestamp: new Date().toISOString(),
      };
    }

    await page.screenshot({ path: join(stateDir, 'before-screenshot.png'), fullPage: false });

    // Begin tracking deltas only AFTER the before-snapshot.
    page.on('request', onRequest);
    page.on('response', onResponse);

    if (entry.action === 'hover') {
      await locator.hover({ timeout: 5_000 });
    } else if (entry.action === 'navigate') {
      // Click anchors normally — let the SPA router or full navigation happen.
      await locator.click({ timeout: 5_000 });
    } else {
      await locator.click({ timeout: 5_000 });
    }
    await page.waitForTimeout(ACTION_WAIT_MS);

    const afterHtml = await page.content();
    writeFileSync(join(stateDir, 'after.html'), afterHtml);
    await page.screenshot({ path: join(stateDir, 'after-screenshot.png'), fullPage: false });
    writeFileSync(join(stateDir, 'delta-network.json'), JSON.stringify(events, null, 2));
    writeFileSync(
      join(stateDir, 'meta.json'),
      JSON.stringify(
        {
          entryId: entry.id,
          label: entry.label,
          selector: entry.selector,
          action: entry.action,
          timestamp: new Date().toISOString(),
          currentUrl: page.url(),
        },
        null,
        2,
      ),
    );

    return {
      entryId: entry.id,
      route: entry.route,
      label: entry.label,
      selector: entry.selector,
      status: 'success',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const message = (err as Error).message;
    const isTimeout = /timeout/i.test(message);
    writeFileSync(
      join(stateDir, 'error.json'),
      JSON.stringify({ message, entryId: entry.id, selector: entry.selector }, null, 2),
    );
    return {
      entryId: entry.id,
      route: entry.route,
      label: entry.label,
      selector: entry.selector,
      status: isTimeout ? 'timeout' : 'error',
      errorMessage: message,
      timestamp: new Date().toISOString(),
    };
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  process.stderr.write(`[audit-capture] ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
