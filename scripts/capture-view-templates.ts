#!/usr/bin/env tsx
/**
 * Capture one REAL `viz/v1/view/{viewId}` body per ClickUp view-TYPE using the
 * authed persistent Chrome profile (Cameron is logged in). The bodies become
 * per-type structural TEMPLATES the owned backend's vizView synthesizer clones
 * and re-populates for any other view of the same type.
 *
 * It navigates to the live app first to establish the session + frontdoor auth,
 * then runs an in-page `fetch` for each target view id so the app's own auth
 * headers are attached. If a direct fetch fails, it navigates to that view so
 * the bundle fetches it and the response is captured from the network.
 *
 * Output: engine/targets/webapp/backend/view-templates/<type>.json
 *         (raw { view: {...} } body, type-specific structure intact).
 *
 * Usage:
 *   npm run capture:view-templates
 *   tsx scripts/capture-view-templates.ts --types=gantt,table,timeline
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { chromium, type BrowserContext, type Page } from 'playwright';

const PROFILE_DIR = join(homedir(), '.config', 'playwright-pinterest');
const APP_ORIGIN = 'https://app.clickup.com';
const FRONTDOOR = 'https://frontdoor-prod-eu-west-1-3.clickup.com';
const TEAM = '90152566819';
const OUT_DIR = resolve('engine/targets/webapp/backend/view-templates');

/** One representative view id per type. Captured from the public-API catalog. */
const TYPE_TARGETS: Record<string, { id: string; routeLetter: string }> = {
  list: { id: '2kyr6013-1115', routeLetter: 'l' },
  board: { id: '2kyr6013-835', routeLetter: 'b' },
  calendar: { id: '2kyr6013-135', routeLetter: 'c' },
  gantt: { id: '2kyr6013-115', routeLetter: 'g' },
  table: { id: '2kyr6013-155', routeLetter: 't' },
  timeline: { id: '2kyr6013-2155', routeLetter: 'tl' },
};

function parseTypes(argv: string[]): string[] {
  for (const raw of argv) {
    if (raw.startsWith('--types=')) {
      return raw
        .slice('--types='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return Object.keys(TYPE_TARGETS);
}

async function fetchVizInPage(page: Page, viewId: string): Promise<unknown | null> {
  const result = await page.evaluate(
    async ({ frontdoor, id }) => {
      try {
        const res = await fetch(`${frontdoor}/viz/v1/view/${id}`, {
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        if (!res.ok) return { __status: res.status };
        return await res.json();
      } catch (err) {
        return { __error: String(err) };
      }
    },
    { frontdoor: FRONTDOOR, id: viewId },
  );
  if (result && typeof result === 'object' && ('__status' in result || '__error' in result)) {
    return null;
  }
  return result;
}

function isRealViewBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const view = (body as { view?: unknown }).view ?? body;
  if (!view || typeof view !== 'object') return false;
  const v = view as Record<string, unknown>;
  return typeof v.id === 'string' && v.type !== undefined;
}

async function captureViaNetwork(
  context: BrowserContext,
  page: Page,
  viewId: string,
  routeLetter: string,
): Promise<unknown | null> {
  let captured: unknown | null = null;
  const onResponse = async (res: import('playwright').Response): Promise<void> => {
    const u = res.url();
    if (!u.includes(`/viz/v1/view/${viewId}`)) return;
    if (res.status() !== 200) return;
    try {
      captured = await res.json();
    } catch {
      /* ignore */
    }
  };
  context.on('response', onResponse);
  try {
    await page.goto(`${APP_ORIGIN}/${TEAM}/v/${routeLetter}/${viewId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(6000);
  } catch {
    /* ignore navigation errors; we only need the network capture */
  } finally {
    context.off('response', onResponse);
  }
  return captured;
}

async function main(): Promise<void> {
  const types = parseTypes(process.argv.slice(2));
  mkdirSync(OUT_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] ?? (await context.newPage());

  // Establish session: land on the workspace home so frontdoor auth is primed.
  await page.goto(`${APP_ORIGIN}/${TEAM}/home`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(5000);

  const captured: Record<string, { ok: boolean; bytes: number; id: string }> = {};

  for (const type of types) {
    const target = TYPE_TARGETS[type];
    if (!target) {
      process.stdout.write(`skip ${type}: no target id\n`);
      continue;
    }
    process.stdout.write(`capturing ${type} (${target.id})... `);

    let body = await fetchVizInPage(page, target.id);
    if (!isRealViewBody(body)) {
      process.stdout.write('direct fetch failed, trying via navigation... ');
      body = await captureViaNetwork(context, page, target.id, target.routeLetter);
    }

    if (isRealViewBody(body)) {
      const json = JSON.stringify(body, null, 0);
      writeFileSync(join(OUT_DIR, `${type}.json`), json, 'utf8');
      captured[type] = { ok: true, bytes: json.length, id: target.id };
      process.stdout.write(`OK (${json.length}B)\n`);
    } else {
      captured[type] = { ok: false, bytes: 0, id: target.id };
      process.stdout.write('MISS\n');
    }
  }

  await context.close();

  process.stdout.write('\n=== capture summary ===\n');
  for (const [type, info] of Object.entries(captured)) {
    process.stdout.write(`  ${type}: ${info.ok ? `OK ${info.bytes}B` : 'MISS'} (${info.id})\n`);
  }
  const missing = Object.entries(captured).filter(([, i]) => !i.ok).map(([t]) => t);
  if (missing.length > 0) {
    process.stdout.write(`\nMISSING TEMPLATES: ${missing.join(', ')}\n`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`capture-view-templates failed: ${(err as Error).message}\n`);
  process.exit(1);
});
