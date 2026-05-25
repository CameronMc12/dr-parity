// Capture exact y=3950..5050 region in both dev and preview.
import { chromium } from 'playwright';

const URLS = { dev: 'http://localhost:5174/', preview: 'http://localhost:4173/' };

for (const [label, url] of Object.entries(URLS)) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h + 2000; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(2500);
  // Scroll to y=4000 so the carousel is in view at top of viewport, take viewport shot
  await page.evaluate(() => window.scrollTo(0, 3800));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/tmp/w11/${label}-region.png`, fullPage: false });
  console.log(label, '-> /tmp/w11/' + label + '-region.png');
  await browser.close();
}
