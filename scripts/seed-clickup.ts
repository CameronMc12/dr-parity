/**
 * Seed-clickup — opens a headed real-Chrome window on a fresh persistent profile
 * dir so you can manually sign into ClickUp. The script polls the page until it
 * detects an authenticated app session, then closes cleanly. Because the context
 * is persistent, cookies / localStorage are already flushed to disk.
 *
 * The launch mirrors the webapp crawler exactly (same chrome channel + persistent
 * profile dir) so the cookie jar is compatible. The same profile dir is later
 * passed to:
 *   npm run crawl:webapp -- <url> --user-data-dir=<profileDir>
 *
 * Usage:
 *   tsx scripts/seed-clickup.ts [--profile=<path>]
 *   npm run seed:clickup
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOGIN_URL = 'https://app.clickup.com/login';
const POLL_INTERVAL_MS = 1_500;
const LOGIN_TIMEOUT_MS = 8 * 60 * 1_000;
const SETTLE_WAIT_MS = 1_500;

// Authenticated ClickUp URLs land on a numeric team-id path, e.g.
// https://app.clickup.com/9012345/v/... — match a 6+ digit segment.
const TEAM_ID_RE = /app\.clickup\.com\/\d{6,}\//;
const LOGIN_PATH_RE = /\/(login|signin|sign-in|signup|sign-up|onboarding)\b/i;

export interface SeedClickUpOptions {
  profileDir: string;
  viewport: { width: number; height: number };
}

export function defaultProfileDir(): string {
  return join(homedir(), '.config', 'playwright-clickup');
}

export function parseArgs(argv: string[]): SeedClickUpOptions {
  let profileDir = defaultProfileDir();

  for (const raw of argv) {
    if (raw.startsWith('--profile=')) {
      profileDir = raw.slice('--profile='.length);
      continue;
    }
    if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    }
    throw new Error(`Unexpected argument: ${raw}`);
  }

  return { profileDir, viewport: { width: 1440, height: 900 } };
}

async function isAuthenticated(page: Page): Promise<boolean> {
  const url = page.url();
  if (LOGIN_PATH_RE.test(url)) return false;
  if (TEAM_ID_RE.test(url)) return true;

  // Fallback DOM marker: a visible password input means still on the login form;
  // its absence on an app.clickup.com URL is a logged-in signal.
  if (!url.includes('app.clickup.com/')) return false;
  const passwordVisible = await page
    .locator('input[type="password"]:visible')
    .first()
    .count()
    .catch(() => 0);
  return passwordVisible === 0;
}

async function waitForAuthenticatedSession(page: Page): Promise<boolean> {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (page.isClosed()) return false;
    if (await isAuthenticated(page).catch(() => false)) return true;
    await page.waitForTimeout(POLL_INTERVAL_MS).catch(() => undefined);
  }
  return false;
}

export async function seedClickUp(opts: SeedClickUpOptions): Promise<void> {
  console.log(`[seed-clickup] launching persistent Chrome profile: ${opts.profileDir}`);
  console.log(`[seed-clickup] start URL: ${LOGIN_URL}`);

  const context: BrowserContext = await chromium.launchPersistentContext(opts.profileDir, {
    channel: 'chrome',
    headless: false,
    viewport: opts.viewport,
    // Mask automation markers so login flows / bot-detection do not block the
    // manual sign-in. Same profile dir + chrome channel keeps the cookie jar
    // crawler-compatible.
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  console.log('');
  console.log('====================================================');
  console.log(' Log in to ClickUp in the opened window.');
  console.log(' Waiting for authenticated session...');
  console.log(`   (timeout: ${Math.round(LOGIN_TIMEOUT_MS / 60_000)} minutes)`);
  console.log('====================================================');
  console.log('');

  const authenticated = await waitForAuthenticatedSession(page);

  if (!authenticated) {
    console.error('[seed-clickup] timed out (or window closed) before an authenticated session was detected.');
    await context.close().catch(() => undefined);
    process.exit(1);
  }

  // Let cookies / localStorage flush to the persistent profile before closing.
  await page.waitForTimeout(SETTLE_WAIT_MS).catch(() => undefined);
  await context.close().catch(() => undefined);

  console.log(`[seed-clickup] ClickUp session captured at ${opts.profileDir}`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  await seedClickUp(opts);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-clickup] failed:', err);
    process.exit(1);
  });
