/**
 * Seed-verify — captures localStorage + sessionStorage directly from the live
 * real-Chrome page over CDP (storageState() over CDP misses localStorage),
 * merges cookies + storage into the Playwright profile, then verifies the
 * seeded profile is authenticated.
 *
 * Real Chrome must already be running with a debug port and logged in:
 *   open -na "Google Chrome" --args \
 *     --remote-debugging-port=9222 \
 *     --user-data-dir="$HOME/.config/chrome-seed" \
 *     "https://app.omnisocials.com"
 *
 * Usage:
 *   tsx scripts/seed-verify.ts [--cdp=http://localhost:9222] [--user-data-dir=<path>] [--url=<startUrl>]
 *   npm run seed-verify
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_CDP_URL = 'http://localhost:9222';
const DEFAULT_START_URL = 'https://app.omnisocials.com';
const ORIGIN_MATCH = 'omnisocials';
const SCREENSHOT_PATH = '/tmp/omni-auth-check.png';
const FLUSH_WAIT_MS = 3_000;
const SETTLE_WAIT_MS = 2_000;
const LOGGED_OUT_PATTERNS = ['/login', '/signin', 'accounts.google.com'];

export interface SeedVerifyOptions {
  cdpUrl: string;
  userDataDir: string;
  startUrl: string;
}

interface LiveStorage {
  local: Record<string, string>;
  session: Record<string, string>;
}

export function defaultUserDataDir(): string {
  return join(homedir(), '.config', 'playwright-omnisocials');
}

export function parseArgs(argv: string[]): SeedVerifyOptions {
  let cdpUrl = DEFAULT_CDP_URL;
  let userDataDir = defaultUserDataDir();
  let startUrl = DEFAULT_START_URL;

  for (const raw of argv) {
    if (raw.startsWith('--cdp=')) {
      cdpUrl = raw.slice('--cdp='.length);
      continue;
    }
    if (raw.startsWith('--user-data-dir=')) {
      userDataDir = raw.slice('--user-data-dir='.length);
      continue;
    }
    if (raw.startsWith('--url=')) {
      startUrl = raw.slice('--url='.length);
      continue;
    }
    if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    }
    throw new Error(`Unexpected argument: ${raw}`);
  }

  return { cdpUrl, userDataDir, startUrl };
}

function findAppPage(contexts: readonly BrowserContext[]): Page | undefined {
  let firstPage: Page | undefined;
  for (const context of contexts) {
    for (const page of context.pages()) {
      firstPage ??= page;
      if (page.url().includes(ORIGIN_MATCH)) return page;
    }
  }
  return firstPage;
}

async function captureLiveStorage(page: Page): Promise<LiveStorage> {
  return page.evaluate(() => ({
    local: { ...localStorage } as Record<string, string>,
    session: { ...sessionStorage } as Record<string, string>,
  }));
}

async function seedProfile(opts: SeedVerifyOptions): Promise<void> {
  console.log(`[seed-verify] connecting over CDP: ${opts.cdpUrl}`);
  const browser = await chromium.connectOverCDP(opts.cdpUrl);
  const contexts = browser.contexts();

  const page = findAppPage(contexts);
  if (!page) {
    await browser.close();
    throw new Error('No live page found over CDP. Is real Chrome running with --remote-debugging-port?');
  }
  console.log(`[seed-verify] live page: ${page.url()}`);

  const storage = await captureLiveStorage(page);
  const localKeys = Object.keys(storage.local);
  const sessionKeys = Object.keys(storage.session);
  console.log(`[seed-verify] localStorage keys: ${localKeys.length}`);
  console.log(`[seed-verify]   ${localKeys.join(', ') || '(none)'}`);
  console.log(`[seed-verify] sessionStorage keys: ${sessionKeys.length}`);
  console.log(`[seed-verify]   ${sessionKeys.join(', ') || '(none)'}`);

  const sourceContext = page.context();
  const liveState = await sourceContext.storageState();
  await browser.close();

  console.log(`[seed-verify] seeding profile: ${opts.userDataDir}`);
  const seeded = await chromium.launchPersistentContext(opts.userDataDir, {
    channel: 'chrome',
    headless: false,
  });

  await seeded.addCookies(liveState.cookies);
  await seeded.addInitScript(
    (data: LiveStorage) => {
      for (const [name, value] of Object.entries(data.local)) {
        try {
          window.localStorage.setItem(name, value);
        } catch {
          /* storage blocked for this origin */
        }
      }
      for (const [name, value] of Object.entries(data.session)) {
        try {
          window.sessionStorage.setItem(name, value);
        } catch {
          /* storage blocked for this origin */
        }
      }
    },
    storage,
  );

  const seedPage = seeded.pages()[0] ?? (await seeded.newPage());
  await seedPage.goto(opts.startUrl, { waitUntil: 'domcontentloaded' });
  await seedPage.waitForTimeout(FLUSH_WAIT_MS);
  await seeded.close();
  console.log(`[seed-verify] profile seeded at ${opts.userDataDir}`);
}

async function verifyProfile(opts: SeedVerifyOptions): Promise<void> {
  console.log('[seed-verify] verifying seeded profile (headless)');
  const context = await chromium.launchPersistentContext(opts.userDataDir, {
    channel: 'chrome',
    headless: true,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(opts.startUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(SETTLE_WAIT_MS);

  const finalUrl = page.url();
  const title = await page.title();
  const hasLoggedOutMarker = await page.evaluate(() => {
    const text = document.body?.innerText?.toLowerCase() ?? '';
    return /\bsign in\b|\blog in\b|\bsign up\b/.test(text);
  });
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  await context.close();

  const redirectedToLogin = LOGGED_OUT_PATTERNS.some((p) => finalUrl.includes(p));
  const authenticated = finalUrl.includes(ORIGIN_MATCH) && !redirectedToLogin;

  console.log('');
  console.log('==================== AUTH CHECK ====================');
  console.log(`[seed-verify] final URL    : ${finalUrl}`);
  console.log(`[seed-verify] document.title: ${title}`);
  console.log(`[seed-verify] logged-out marker on page: ${hasLoggedOutMarker ? 'YES' : 'no'}`);
  console.log(`[seed-verify] redirected to login: ${redirectedToLogin ? 'YES' : 'no'}`);
  console.log(`[seed-verify] screenshot   : ${SCREENSHOT_PATH}`);
  console.log(`[seed-verify] VERDICT      : ${authenticated && !hasLoggedOutMarker ? 'AUTHENTICATED' : 'NOT-AUTHENTICATED'}`);
  console.log('====================================================');
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  await seedProfile(opts);
  await verifyProfile(opts);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-verify] failed:', err);
    process.exit(1);
  });
