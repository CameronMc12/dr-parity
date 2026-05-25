// Pixel-diff full pages dev vs preview using PNG buffer compare.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const URLS = { dev: 'http://localhost:5174/', preview: 'http://localhost:4173/' };

async function snap(url, label, path) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h + 2000; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await page.screenshot({ path, fullPage: true });
  await browser.close();
  console.log(label, '->', path);
}

await snap(URLS.dev, 'dev', '/tmp/w11/dev-v2.png');
await snap(URLS.preview, 'preview', '/tmp/w11/preview-v2.png');

// Diff
const a = PNG.sync.read(readFileSync('/tmp/w11/dev-v2.png'));
const b = PNG.sync.read(readFileSync('/tmp/w11/preview-v2.png'));
const W = Math.min(a.width, b.width);
const H = Math.min(a.height, b.height);
let differing = 0;
let total = W * H;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const ia = (y * a.width + x) * 4;
    const ib = (y * b.width + x) * 4;
    if (a.data[ia] !== b.data[ib] || a.data[ia+1] !== b.data[ib+1] || a.data[ia+2] !== b.data[ib+2]) {
      differing++;
    }
  }
}
const score = 100 * (1 - differing / total);
console.log(`Pixel diff: differing=${differing} total=${total} score=${score.toFixed(4)}%`);

// Find which Y ranges differ the most
const rowDiffs = new Array(H).fill(0);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const ia = (y * a.width + x) * 4;
    const ib = (y * b.width + x) * 4;
    if (a.data[ia] !== b.data[ib] || a.data[ia+1] !== b.data[ib+1] || a.data[ia+2] !== b.data[ib+2]) {
      rowDiffs[y]++;
    }
  }
}
// Top 5 differing rows in 200-px windows
const windowSize = 200;
const windows = [];
for (let y = 0; y < H; y += windowSize) {
  let s = 0;
  for (let yy = y; yy < y + windowSize && yy < H; yy++) s += rowDiffs[yy];
  windows.push({ y0: y, y1: Math.min(y + windowSize, H), diff: s });
}
windows.sort((a, b) => b.diff - a.diff);
console.log('Top differing windows:');
for (const w of windows.slice(0, 8)) {
  console.log(`  y=${w.y0}..${w.y1}  diff=${w.diff}`);
}
