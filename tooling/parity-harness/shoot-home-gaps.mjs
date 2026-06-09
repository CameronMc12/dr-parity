import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'tooling/parity-harness/output/home-gaps-2026-06-01';
const BASE = 'http://localhost:4280/90152566819';
const tag = process.argv[2] ?? 'after';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shoot(name, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  console.log(`OK ${tag}-${name}`);
}

await shoot('home', '/home');
await shoot('inbox', '/inbox');
await shoot('replies', '/chat/r/threads');
await shoot('assigned', '/chat/r/assigned');

// kebab hover + menu on a sidebar row (home)
await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
try {
  const row = page.locator('[data-row-kebab]').first();
  await row.scrollIntoViewIfNeeded();
  // hover the parent row to reveal kebab
  await row.hover({ force: true }).catch(() => {});
  await page.waitForTimeout(150);
  await row.click({ force: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${tag}-row-menu.png` });
  console.log(`OK ${tag}-row-menu`);
} catch (e) {
  console.log(`FAIL row-menu: ${e.message.split('\n')[0]}`);
}

await browser.close();
console.log('done');
