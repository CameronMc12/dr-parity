/**
 * Seed-from-CDP fallback — for when Google STILL blocks the Playwright-launched
 * window. You log into REAL Chrome (launched by the OS with only a debug port,
 * zero automation flags, so Google cannot detect it), then this script extracts
 * the live session over CDP and seeds it into the Playwright profile dir.
 *
 * Launch real Chrome first (example):
 *   open -na "Google Chrome" --args \
 *     --remote-debugging-port=9222 \
 *     --user-data-dir="$HOME/.config/chrome-seed" \
 *     "https://app.omnisocials.com"
 *
 * Then, once you are fully signed in:
 *   tsx scripts/seed-from-cdp.ts <startUrl> [--cdp=http://localhost:9222] [--user-data-dir=<path>]
 *   npm run seed-from-cdp -- https://app.omnisocials.com
 *
 * The seeded profile dir matches the crawler's, so:
 *   npm run crawl:webapp -- <url> --user-data-dir=<path>
 * reuses the captured session.
 */

import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_CDP_URL = 'http://localhost:9222';
const FLUSH_WAIT_MS = 3_000;

export interface SeedFromCdpOptions {
  startUrl: string;
  cdpUrl: string;
  userDataDir: string;
}

export function defaultUserDataDir(): string {
  return join(homedir(), '.config', 'playwright-omnisocials');
}

export function parseArgs(argv: string[]): SeedFromCdpOptions {
  let startUrl: string | undefined;
  let cdpUrl = DEFAULT_CDP_URL;
  let userDataDir = defaultUserDataDir();

  for (const raw of argv) {
    if (raw.startsWith('--cdp=')) {
      cdpUrl = raw.slice('--cdp='.length);
      continue;
    }
    if (raw.startsWith('--user-data-dir=')) {
      userDataDir = raw.slice('--user-data-dir='.length);
      continue;
    }
    if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    }
    if (!startUrl) {
      startUrl = raw;
      continue;
    }
    throw new Error(`Unexpected argument: ${raw}`);
  }

  if (!startUrl) {
    throw new Error(
      'Missing <startUrl>. Usage: tsx scripts/seed-from-cdp.ts <startUrl> [--cdp=http://localhost:9222] [--user-data-dir=<path>]',
    );
  }

  return { startUrl, cdpUrl, userDataDir };
}

export async function seedFromCdp(opts: SeedFromCdpOptions): Promise<void> {
  console.log(`[seed-from-cdp] connecting to real Chrome over CDP: ${opts.cdpUrl}`);
  const browser = await chromium.connectOverCDP(opts.cdpUrl);

  const sourceContext = browser.contexts()[0];
  if (!sourceContext) {
    await browser.close();
    throw new Error('No browser context found over CDP. Is real Chrome running with --remote-debugging-port?');
  }

  console.log('[seed-from-cdp] reading live session (cookies + localStorage)');
  const storage = await sourceContext.storageState();
  console.log(`[seed-from-cdp] captured ${storage.cookies.length} cookies, ${storage.origins.length} origins`);
  await browser.close();

  console.log(`[seed-from-cdp] seeding Playwright profile: ${opts.userDataDir}`);
  const seeded = await chromium.launchPersistentContext(opts.userDataDir, {
    channel: 'chrome',
    headless: false,
  });

  await seeded.addCookies(storage.cookies);

  for (const origin of storage.origins) {
    const items = origin.localStorage;
    await seeded.addInitScript((entries: ReadonlyArray<{ name: string; value: string }>) => {
      for (const { name, value } of entries) {
        try {
          window.localStorage.setItem(name, value);
        } catch {
          // Storage may be partitioned / blocked for this origin; skip.
        }
      }
    }, items);
  }

  console.log(`[seed-from-cdp] realizing origins by navigating to: ${opts.startUrl}`);
  const page = seeded.pages()[0] ?? (await seeded.newPage());
  await page.goto(opts.startUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(FLUSH_WAIT_MS);

  await seeded.close();
  console.log(`[seed-from-cdp] profile seeded at ${opts.userDataDir}`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  await seedFromCdp(opts);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-from-cdp] failed:', err);
    process.exit(1);
  });
