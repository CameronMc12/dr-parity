/**
 * Seed-login launcher — opens a headed real-Chrome window on a persistent
 * profile dir so you can manually sign into a web app. When you close the
 * window (or hit Ctrl-C), the script flushes cookies / localStorage to disk
 * and exits cleanly.
 *
 * The launch mirrors the webapp crawler exactly so the cookie jar is
 * compatible. The same profile dir is later passed to:
 *   npm run crawl:webapp -- <url> --user-data-dir=<profileDir>
 *
 * Usage:
 *   tsx scripts/seed-login.ts <startUrl> [--user-data-dir=<path>]
 *   npm run seed-login -- https://app.omnisocials.com
 */

import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SeedLoginOptions {
  startUrl: string;
  userDataDir: string;
  viewport: { width: number; height: number };
}

export function defaultUserDataDir(): string {
  return join(homedir(), '.config', 'playwright-omnisocials');
}

export function parseArgs(argv: string[]): SeedLoginOptions {
  let startUrl: string | undefined;
  let userDataDir = defaultUserDataDir();

  for (const raw of argv) {
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
    throw new Error('Missing <startUrl>. Usage: tsx scripts/seed-login.ts <startUrl> [--user-data-dir=<path>]');
  }

  return { startUrl, userDataDir, viewport: { width: 1440, height: 900 } };
}

export async function seedLogin(opts: SeedLoginOptions): Promise<void> {
  console.log(`[seed-login] launching persistent Chrome profile: ${opts.userDataDir}`);
  console.log(`[seed-login] start URL: ${opts.startUrl}`);

  const context = await chromium.launchPersistentContext(opts.userDataDir, {
    channel: 'chrome',
    headless: false,
    viewport: opts.viewport,
    // Defeat Google OAuth bot detection. These flags / init script only mask
    // automation markers; they do NOT change the cookie jar (same profile dir,
    // same chrome channel), so crawler compatibility is preserved.
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  let closed = false;
  const flushAndClose = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await context.close();
    } catch {
      // Context already torn down (e.g. window closed by the user).
    }
  };

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(opts.startUrl, { waitUntil: 'domcontentloaded' });

  console.log('');
  console.log('====================================================');
  console.log(' BROWSER IS OPEN. PLEASE LOG IN.');
  console.log('');
  console.log(' When you are fully signed in and ready, CLOSE the');
  console.log(' Chrome window (or press Ctrl-C here). The session');
  console.log(' will be saved to the profile dir above.');
  console.log('====================================================');
  console.log('');

  await new Promise<void>((resolve) => {
    context.on('close', () => resolve());
    process.once('SIGINT', () => {
      void flushAndClose().then(resolve);
    });
  });

  await flushAndClose();
  console.log('[seed-login] session saved. Profile persisted to disk.');
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  await seedLogin(opts);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-login] failed:', err);
    process.exit(1);
  });
