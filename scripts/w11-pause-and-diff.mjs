// Pause carousel animation in both modes, normalize slide 0 to "current",
// then diff. If still differing, there IS a Shape C. If matching, confirm closed.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const URLS = { dev: 'http://localhost:5174/', preview: 'http://localhost:4173/' };

async function snap(url, label) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h + 2000; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(2500);

  // Hover over the TV gallery to pause the auto-advance
  await page.evaluate(() => {
    const g = document.querySelector('.tv-media-gallery');
    if (g) g.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await page.waitForTimeout(300);

  // Try clicking the pause button if any
  const pauseBtn = await page.$('.tv-media-gallery [data-ac-gallery-pause-button], .tv-media-gallery .media-gallery-pause-button, .tv-media-gallery button[aria-label*="ause"]');
  if (pauseBtn) {
    try { await pauseBtn.click({ timeout: 1000 }); } catch {}
  }

  // Hover to also pause
  await page.hover('.tv-media-gallery').catch(() => {});
  await page.waitForTimeout(1000);

  // Take the screenshot of full page with carousel paused
  await page.screenshot({ path: `/tmp/w11/${label}-paused.png`, fullPage: true });

  // Also dump slide 0 state
  const state = await page.evaluate(() => {
    const tv = document.querySelector('.tv-media-gallery');
    const s0 = tv?.querySelector('[data-media-gallery-item="1"]');
    return s0 ? { cls: s0.className, style: s0.getAttribute('style') } : null;
  });
  console.log(label, 'slide0 state:', state);
  await browser.close();
}

await snap(URLS.dev, 'dev');
await snap(URLS.preview, 'preview');

// Diff
const a = PNG.sync.read(readFileSync('/tmp/w11/dev-paused.png'));
const b = PNG.sync.read(readFileSync('/tmp/w11/preview-paused.png'));
const W = Math.min(a.width, b.width);
const H = Math.min(a.height, b.height);
let differing = 0;
const rowDiffs = new Array(H).fill(0);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const ia = (y * a.width + x) * 4;
    const ib = (y * b.width + x) * 4;
    if (a.data[ia] !== b.data[ib] || a.data[ia+1] !== b.data[ib+1] || a.data[ia+2] !== b.data[ib+2]) {
      differing++;
      rowDiffs[y]++;
    }
  }
}
const total = W * H;
console.log(`PAUSED pixel diff: differing=${differing} total=${total} score=${(100 * (1 - differing / total)).toFixed(4)}%`);

const windows = [];
for (let y = 0; y < H; y += 200) {
  let s = 0;
  for (let yy = y; yy < y + 200 && yy < H; yy++) s += rowDiffs[yy];
  if (s > 0) windows.push({ y0: y, y1: Math.min(y + 200, H), diff: s });
}
windows.sort((a, b) => b.diff - a.diff);
console.log('Top differing windows (paused):');
for (const w of windows.slice(0, 8)) {
  console.log(`  y=${w.y0}..${w.y1}  diff=${w.diff}`);
}
