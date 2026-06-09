import { chromium } from 'playwright';

const OUT = 'tooling/parity-harness/output/home-pages-2026-06-01';
const BASE = 'http://localhost:4280/90152566819';

const PAGES: Array<{ name: string; path: string }> = [
  { name: 'inbox', path: '/inbox' },
  { name: 'replies', path: '/chat/r/threads' },
  { name: 'assigned-comments', path: '/chat/r/assigned' },
  { name: 'my-tasks', path: '/my-work' },
];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const p of PAGES) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/after-${p.name}.png` });
    console.log(`shot after-${p.name}.png`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
