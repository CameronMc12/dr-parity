/**
 * Live probe for the L2 runtime store-discovery module.
 *
 * Launches Playwright with the most recent crawl `storage-state.json`, navigates
 * to a real ClickUp workspace route, runs discoverStores + dumpState, and prints
 * which stores were found plus the top-level key names of each snapshot.
 *
 * If auth is stale (redirected to login) it reports that clearly and still saves
 * whatever it got to docs/research/clickup-parity/state-probe-sample.json. The
 * discovery code is defensive across all four strategies, so this probe will
 * yield real snapshots the moment a fresh storage-state.json exists.
 *
 *   npm run probe:store
 *   npm run probe:store -- --headed
 *   npm run probe:store -- --url=https://app.clickup.com/90152566819/home
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext } from 'playwright';

type NewContextStorageState = NonNullable<Parameters<Browser['newContext']>[0]>['storageState'];
import { discoverStores, dumpState } from '../engine/targets/webapp/crawler/state-dump';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CRAWL_ROOT = join(REPO_ROOT, 'docs/research/crawl/app.clickup.com');
const SAMPLE_OUT = join(REPO_ROOT, 'docs/research/clickup-parity/state-probe-sample.json');
const DEFAULT_WSID = '90152566819';
const LOGIN_RE = /\/(login|signin|sign-in|signup|sign-up|auth)\b/i;

type WrappedStorageState = {
  storageState?: { cookies?: unknown[]; origins?: unknown[] };
  url?: string;
};

function getArg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function walkForStorageStates(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkForStorageStates(full, out);
    } else if (entry.isFile() && entry.name === 'storage-state.json') {
      out.push(full);
    }
  }
}

function findMostRecentStorageState(): string | null {
  const matches: string[] = [];
  walkForStorageStates(CRAWL_ROOT, matches);
  if (matches.length === 0) return null;
  return matches
    .map((p) => ({ p, mtime: statSync(p).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0].p;
}

/** Top-level key names of a snapshot section, defensively. */
function topKeys(section: unknown): string[] {
  if (!section || typeof section !== 'object') return [];
  return Object.keys(section as Record<string, unknown>);
}

async function main(): Promise<void> {
  const headed = process.argv.includes('--headed');
  const statePath = getArg('state') ?? findMostRecentStorageState();
  const targetUrl = getArg('url') ?? `https://app.clickup.com/${DEFAULT_WSID}/home`;

  if (!statePath || !existsSync(statePath)) {
    console.error('[probe] no storage-state.json found under', CRAWL_ROOT);
    console.error('[probe] run a crawl/login first to produce one.');
    process.exit(1);
  }
  console.log('[probe] storage-state :', statePath);
  console.log('[probe] target url    :', targetUrl);

  // The crawler wraps Playwright's storageState inside a ReplayStorageState.
  const wrapped = JSON.parse(readFileSync(statePath, 'utf8')) as WrappedStorageState;
  const playwrightState = wrapped.storageState ?? wrapped;
  const cookieCount = (playwrightState as { cookies?: unknown[] }).cookies?.length ?? 0;
  console.log('[probe] cookies seeded:', cookieCount);

  const browser = await chromium.launch({
    headless: !headed,
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
    storageState: playwrightState as NewContextStorageState,
  });

  const page = await context.newPage();

  let authStale = false;
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  } catch (err) {
    console.warn('[probe] navigation error:', err instanceof Error ? err.message : String(err));
  }
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(7_000);

  const landedUrl = page.url();
  if (LOGIN_RE.test(landedUrl)) {
    authStale = true;
    console.warn('\n[probe] AUTH STALE — redirected to login:', landedUrl);
    console.warn('[probe] refresh the session (re-run a logged-in crawl) to get a live snapshot.');
  } else {
    console.log('[probe] landed url    :', landedUrl);
  }

  const discovery = await discoverStores(page);
  const dump = await dumpState(page);

  console.log('\n=== STORE DISCOVERY ===');
  console.log('ngxs found :', discovery.ngxs);
  console.log('react found:', discovery.react);
  console.log('via        :', discovery.source.join(', ') || '(none)');

  console.log('\n=== SNAPSHOT TOP-LEVEL KEYS ===');
  console.log('ngxs keys  :', topKeys(dump.ngxs).join(', ') || '(no ngxs snapshot)');
  console.log('react keys :', topKeys(dump.react).join(', ') || '(no react snapshot)');

  mkdirSync(dirname(SAMPLE_OUT), { recursive: true });
  const sample = {
    probedAt: new Date().toISOString(),
    statePath,
    targetUrl,
    landedUrl,
    authStale,
    cookiesSeeded: cookieCount,
    discovery,
    ngxsKeys: topKeys(dump.ngxs),
    reactKeys: topKeys(dump.react),
    dump,
  };
  writeFileSync(SAMPLE_OUT, JSON.stringify(sample, null, 2), 'utf8');
  console.log('\n[probe] sample saved  :', SAMPLE_OUT);

  await context.close();
  await browser.close();
  if (authStale) {
    console.log('\n[probe] DONE (auth stale — discovery code verified defensive, awaiting fresh session).');
  } else {
    console.log('\n[probe] DONE.');
  }
}

main().catch((err) => {
  console.error('[probe] fatal:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
