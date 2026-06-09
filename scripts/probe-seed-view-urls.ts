/**
 * STEP 1 — Discover REAL live ClickUp view URLs for the DR-PARITY-SEED list.
 *
 * Navigates to the seed List view (NOT the space overview), waits for the
 * views-bar, then for each known view label clicks the tab and records the
 * resulting window.location.href. Also dumps every tab element's text + href so
 * we can read the canonical typed URL directly.
 *
 * Output: docs/research/clickup-parity/seed-view-urls.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO_ROOT, 'docs/research/clickup-parity/seed-view-urls.json');
const USER_DATA_DIR = join(homedir(), '.config', 'playwright-pinterest');
const TEAM = '90152566819';
const LIST_ID = '901523751540';
const SEED_LIST_URL = `https://app.clickup.com/${TEAM}/v/l/li/${LIST_ID}`;

const WANTED = ['List', 'Board', 'Calendar', 'Gantt', 'Timeline', 'Table'];

interface Resolved {
  label: string;
  url: string | null;
  note?: string;
}

async function dumpTabs(page: Page): Promise<Array<{ text: string; href: string | null }>> {
  return page.evaluate(() => {
    const out: Array<{ text: string; href: string | null }> = [];
    const els = Array.from(
      document.querySelectorAll(
        '[data-test*="view"], [class*="views-bar"] *, [class*="view-tab"], [role="tab"], a[href*="/v/"]',
      ),
    );
    for (const el of els) {
      const text = (el.textContent || '').trim();
      const href = (el as HTMLAnchorElement).href || el.getAttribute('href');
      if (!text || text.length > 24) continue;
      out.push({ text, href: href ?? null });
    }
    // de-dup by text+href
    const seen = new Set<string>();
    return out.filter((o) => {
      const k = o.text + '|' + (o.href ?? '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });
}

async function clickTab(page: Page, label: string): Promise<string | null> {
  const loc = page.getByText(label, { exact: true }).first();
  try {
    if ((await loc.count()) === 0) return null;
    await loc.click({ timeout: 4000 });
  } catch {
    return null;
  }
  await page.waitForTimeout(2200);
  return page.url();
}

async function main(): Promise<void> {
  mkdirSync(dirname(OUT), { recursive: true });
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1600, height: 1000 },
    serviceWorkers: 'block',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = context.pages()[0] ?? (await context.newPage());

  const results: Resolved[] = [];
  let tabDump: Array<{ text: string; href: string | null }> = [];
  try {
    await page.goto(SEED_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6000); // let the list view fully mount its views-bar
    if (/\/(login|signin|auth)\b/i.test(page.url())) {
      throw new Error(`Redirected to login: ${page.url()} — auth stale.`);
    }
    console.log('[probe] landed on:', page.url());

    tabDump = await dumpTabs(page);
    console.log('[probe] tab dump:', JSON.stringify(tabDump));

    for (const label of WANTED) {
      await page.goto(SEED_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);
      const url = await clickTab(page, label);
      if (url) {
        results.push({ label, url });
        console.log(`[probe] ${label} -> ${url}`);
      } else {
        results.push({ label, url: null, note: 'tab not found' });
        console.log(`[probe] ${label} -> NOT FOUND`);
      }
    }
  } finally {
    writeFileSync(
      OUT,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), seedListUrl: SEED_LIST_URL, teamId: TEAM, listId: LIST_ID, views: results, tabDump },
        null,
        2,
      ),
    );
    console.log('[probe] wrote', OUT);
    await context.close();
  }
}

main().catch((err) => {
  console.error('[probe] FAILED:', err?.message ?? err);
  process.exit(1);
});
