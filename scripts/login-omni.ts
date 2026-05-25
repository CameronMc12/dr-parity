/**
 * Login helper — opens Chrome with the dr-parity persistent profile,
 * navigates to the target URL, and waits indefinitely so you can sign in.
 *
 * Cookies / storage are saved into ~/.config/playwright-pinterest
 * Subsequent `npm run capture -- <url> --mode=persistent` runs (from
 * dr-parity) reuse the same profile and stay logged in.
 *
 * Usage:
 *   cd /Users/cameronmcallister/Github/dr-parity
 *   npx tsx /Users/cameronmcallister/Github/omnichannel-clone/scripts/login.ts
 *
 * When you are signed in and ready, close the Chrome window.
 */

import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TARGET_URL = process.argv[2] ?? 'https://app.omnisocials.com';
const USER_DATA_DIR = join(homedir(), '.config', 'playwright-pinterest');

async function main() {
  console.log('[login] launching Chrome with persistent profile');
  console.log('[login] profile dir:', USER_DATA_DIR);
  console.log('[login] target URL:', TARGET_URL);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch {
      /* noop */
    }
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  console.log('');
  console.log('====================================================');
  console.log(' BROWSER IS OPEN. PLEASE LOG IN.');
  console.log('');
  console.log(' When you are fully signed in and ready, simply');
  console.log(' CLOSE the Chrome window. The session will persist.');
  console.log('====================================================');
  console.log('');

  await new Promise<void>((resolve) => {
    context.on('close', () => resolve());
  });

  console.log('[login] browser closed, session saved.');
}

main().catch((err) => {
  console.error('[login] failed:', err);
  process.exit(1);
});
