// Use Playwright to take a clipped screenshot of the TV gallery section in dev and preview.
import { chromium } from 'playwright';

const URLS = { dev: 'http://localhost:5174/', preview: 'http://localhost:4173/' };

for (const [label, url] of Object.entries(URLS)) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  // scroll to bottom + back to wake lazy
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h + 2000; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);
  // Scroll TV gallery into center view
  await page.evaluate(() => {
    const g = document.querySelector('.tv-media-gallery');
    if (g) g.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForTimeout(600);
  // Clip-screenshot the gallery
  const el = await page.$('.tv-media-gallery');
  if (el) {
    await el.screenshot({ path: `/tmp/w11/${label}-tv-only.png` });
    console.log(label, '-> /tmp/w11/' + label + '-tv-only.png');
  } else {
    console.log(label, 'no .tv-media-gallery');
  }

  const el2 = await page.$('.fam-media-gallery');
  if (el2) {
    await el2.screenshot({ path: `/tmp/w11/${label}-fam-only.png` });
    console.log(label, '-> /tmp/w11/' + label + '-fam-only.png');
  }
  await browser.close();
}
