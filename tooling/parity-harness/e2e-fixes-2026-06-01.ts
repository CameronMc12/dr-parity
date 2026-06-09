/**
 * E2E verification for the 2026-06-01 fixes:
 *   1. SSR date-locale hydration mismatch (zero console/page errors)
 *   2. channel rename + delete
 *   3. list task delete via kebab
 *
 * Run: node_modules/.bin/playwright ... (invoked via tsx)
 *   npx tsx tooling/parity-harness/e2e-fixes-2026-06-01.ts
 */

import { chromium, type ConsoleMessage } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:4280';
const HOME = `${BASE}/90152566819/home`;
const OUT = join(process.cwd(), 'tooling/parity-harness/output/e2e-fixes-2026-06-01');
mkdirSync(OUT, { recursive: true });

const HYDRATION_RE =
  /hydrat|did not match|Text content does not match|server rendered|server-rendered/i;

interface ErrorSink {
  consoleErrors: string[];
  pageErrors: string[];
  hydrationErrors: string[];
}

function attach(page: import('playwright').Page): ErrorSink {
  const sink: ErrorSink = { consoleErrors: [], pageErrors: [], hydrationErrors: [] };
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') {
      const t = m.text();
      sink.consoleErrors.push(t);
      if (HYDRATION_RE.test(t)) sink.hydrationErrors.push(t);
    }
  });
  page.on('pageerror', (e) => {
    sink.pageErrors.push(e.message);
    if (HYDRATION_RE.test(e.message)) sink.hydrationErrors.push(e.message);
  });
  return sink;
}

async function clearWorkspace(page: import('playwright').Page) {
  await page.evaluate(() => {
    localStorage.removeItem('parity-workspace-v1');
  });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const sink = attach(page);
  const results: Record<string, string> = {};

  // ── Issue 1: load home, assert zero errors ──────────────────────────────
  await page.goto(HOME, { waitUntil: 'networkidle' });
  await clearWorkspace(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, '01-home.png'), fullPage: true });

  // Navigate into a list so date formatting renders.
  // Expand a space, click first list row.
  const listOpened = await openFirstList(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, '02-list.png'), fullPage: true });

  results.issue1 =
    sink.hydrationErrors.length === 0 && sink.pageErrors.length === 0
      ? `PASS (console errors: ${sink.consoleErrors.length}, hydration: 0, pageerrors: 0)`
      : `FAIL (hydration: ${sink.hydrationErrors.length}, pageerrors: ${sink.pageErrors.length})`;

  // ── Issue 3: delete a task via kebab from the list view ─────────────────
  if (listOpened) {
    results.issue3 = await testTaskDelete(page);
  } else {
    results.issue3 = 'SKIP (no list reachable)';
  }
  await page.screenshot({ path: join(OUT, '03-task-deleted.png'), fullPage: true });

  // ── Issue 2: rename + delete a channel ──────────────────────────────────
  results.issue2 = await testChannel(page);
  await page.screenshot({ path: join(OUT, '04-channel.png'), fullPage: true });

  // ── Cleanup: wipe test data so preview is clean ─────────────────────────
  await clearWorkspace(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  console.log('\n=== E2E RESULTS ===');
  console.log('Issue 1 (date hydration):', results.issue1);
  console.log('Issue 2 (channel CRUD):  ', results.issue2);
  console.log('Issue 3 (task delete):   ', results.issue3);
  console.log('console error count:', sink.consoleErrors.length);
  if (sink.consoleErrors.length) {
    console.log('--- console errors ---');
    for (const e of sink.consoleErrors.slice(0, 10)) console.log('  ', e);
  }
  if (sink.pageErrors.length) {
    console.log('--- page errors ---');
    for (const e of sink.pageErrors.slice(0, 10)) console.log('  ', e);
  }

  await browser.close();
}

async function openFirstList(page: import('playwright').Page): Promise<boolean> {
  // Click sidebar tree rows to expand, then open a list. The list view exposes
  // data-testid="list-task-row" once mounted.
  // Try expanding any collapsed space rows by clicking labels in the Spaces tree.
  const candidates = page.locator('[data-testid="list-task-row"], [data-testid="list-quick-add"]');
  for (let attempt = 0; attempt < 6; attempt++) {
    if ((await candidates.count()) > 0) return true;
    // Click visible sidebar items that look like tree rows / lists.
    const rows = page.locator('button, [role="button"]').filter({ hasText: /./ });
    const n = Math.min(await rows.count(), 40);
    let clicked = false;
    for (let i = 0; i < n; i++) {
      const r = rows.nth(i);
      const txt = (await r.textContent())?.trim() ?? '';
      if (/list|tasks|sprint|backlog|project/i.test(txt) && txt.length < 40) {
        await r.click({ trial: false }).catch(() => {});
        clicked = true;
        await page.waitForTimeout(300);
        if ((await candidates.count()) > 0) return true;
      }
    }
    if (!clicked) await page.waitForTimeout(300);
  }
  return (await candidates.count()) > 0;
}

async function testTaskDelete(page: import('playwright').Page): Promise<string> {
  const rows = page.locator('[data-testid="list-task-row"]');
  const before = await rows.count();
  if (before === 0) return 'SKIP (no tasks in list)';

  const firstRow = rows.first();
  const name = (await firstRow.locator('span').first().textContent())?.trim() ?? '';
  await firstRow.hover();
  const kebab = firstRow.locator('[data-testid="list-task-kebab"]');
  await kebab.click();
  await page.getByRole('menuitem', { name: /delete/i }).click();
  await page.waitForTimeout(400);

  const after = await page.locator('[data-testid="list-task-row"]').count();
  if (after !== before - 1) return `FAIL (rows ${before} -> ${after})`;

  // Persistence: reload and confirm the deleted task is still gone.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await openFirstList(page);
  const persisted = await page
    .locator('[data-testid="list-task-row"]')
    .filter({ hasText: name })
    .count();
  return persisted === 0 ? `PASS (rows ${before} -> ${after}, persisted)` : 'FAIL (reappeared after reload)';
}

async function testChannel(page: import('playwright').Page): Promise<string> {
  // Channels live in the Home sidebar. Find a channel row, open its kebab.
  const channel = page.locator('text=AB Content Management').first();
  if ((await channel.count()) === 0) return 'SKIP (no channel row found)';

  // Hover the row to reveal the kebab.
  const row = channel.locator('xpath=ancestor::*[contains(@class,"cu-row-kebab-wrap")][1]');
  await row.hover();
  const kebab = row.locator('[data-row-kebab]');
  await kebab.click();

  // Rename.
  await page.getByRole('menuitem', { name: /rename/i }).click();
  const input = page.locator('[data-testid="inline-rename"]');
  await input.fill('Renamed Channel QA');
  await input.press('Enter');
  await page.waitForTimeout(300);
  const renamed = await page.locator('text=Renamed Channel QA').count();
  if (renamed === 0) return 'FAIL (rename not reflected)';

  // Delete the renamed channel.
  const row2 = page
    .locator('text=Renamed Channel QA')
    .first()
    .locator('xpath=ancestor::*[contains(@class,"cu-row-kebab-wrap")][1]');
  await row2.hover();
  await row2.locator('[data-row-kebab]').click();
  await page.getByRole('menuitem', { name: /^delete$/i }).click();
  await page.waitForTimeout(300);
  const gone = await page.locator('text=Renamed Channel QA').count();
  return gone === 0 ? 'PASS (renamed + deleted)' : 'FAIL (delete not reflected)';
}

main().catch((e) => {
  console.error('E2E run failed:', e);
  process.exit(1);
});
