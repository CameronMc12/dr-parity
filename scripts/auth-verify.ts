/**
 * Quick auth verification — opens the persistent profile headless,
 * navigates to the target URL, waits for network idle, and reports:
 *  - final URL (redirect destination)
 *  - <title>
 *  - whether a login form is visible (heuristic)
 *  - cookie count
 */

import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TARGET_URL = process.argv[2] ?? 'https://app.omnisocials.com';
const USER_DATA_DIR = join(homedir(), '.config', 'playwright-pinterest');

async function main() {
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000); // let SPA hydrate

  const finalUrl = page.url();
  const title = await page.title();

  const hasLoginForm = await page
    .evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const hasPassword = inputs.some((i) => i.type === 'password');
      const hasEmailOrUser = inputs.some(
        (i) => i.type === 'email' || /user|email/i.test(i.name || i.id || ''),
      );
      return hasPassword && hasEmailOrUser;
    })
    .catch(() => false);

  const cookies = await ctx.cookies();

  console.log(JSON.stringify({
    finalUrl,
    title,
    hasLoginForm,
    cookieCount: cookies.length,
    cookieHosts: [...new Set(cookies.map((c) => c.domain))],
  }, null, 2));

  await ctx.close();
}

main().catch((err) => {
  console.error('[auth-verify] failed:', err);
  process.exit(1);
});
