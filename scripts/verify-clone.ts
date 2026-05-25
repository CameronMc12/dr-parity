/**
 * Screenshot the running React clone at every route and save side-by-side
 * with the original captured screenshots for sanity check.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = '/Users/cameronmcallister/Github/omnichannel-clone/docs/verify-clone';

const ROUTES = [
  { name: 'index', path: '/' },
  { name: 'posts', path: '/posts.html' },
  { name: 'social-inbox', path: '/social-inbox.html' },
  { name: 'analytics', path: '/analytics.html' },
  { name: 'reviews', path: '/reviews.html' },
  { name: 'workflows', path: '/workflows.html' },
  { name: 'approval', path: '/approval.html' },
  { name: 'link-in-bio', path: '/link-in-bio.html' },
  { name: 'library', path: '/library.html' },
];

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  for (const r of ROUTES) {
    const url = `${BASE}${r.path}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const file = join(OUT, `${r.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const title = await page.title();
      const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 80);
      console.log(`  ${r.name.padEnd(15)}  title="${title.slice(0, 35)}"  body="${bodyText.replace(/\n/g, ' ')}"`);
    } catch (err) {
      console.log(`  ${r.name.padEnd(15)}  FAIL: ${(err as Error).message}`);
    }
  }

  await browser.close();
  console.log(`\nScreenshots: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
