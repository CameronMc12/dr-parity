// Verify: dev and preview now share the same carousel slide state.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const URLS = { dev: 'http://localhost:5173/', preview: 'http://localhost:4173/' };

async function probe(url, label) {
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
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // Slide 0 state
  const state = await page.evaluate(() => {
    const tv = document.querySelector('.tv-media-gallery');
    const fam = document.querySelector('.fam-media-gallery');
    const s0 = tv?.querySelector('[data-media-gallery-item="1"]');
    const f0 = fam?.querySelector('[data-media-gallery-item="1"]');
    const tvSlides = Array.from(tv?.querySelectorAll('.media-gallery-item') || []).map((s, i) => ({
      i,
      cls: s.className,
      hasStyle: !!s.getAttribute('style'),
      style: (s.getAttribute('style') || '').slice(0, 80),
    }));
    const famSlides = Array.from(fam?.querySelectorAll('.media-gallery-item') || []).map((s, i) => ({
      i,
      cls: s.className,
      hasStyle: !!s.getAttribute('style'),
      style: (s.getAttribute('style') || '').slice(0, 80),
    }));
    return {
      tvSlide0: s0 ? { cls: s0.className, style: s0.getAttribute('style') } : null,
      famSlide0: f0 ? { cls: f0.className, style: f0.getAttribute('style') } : null,
      tvSlides,
      famSlides,
    };
  });

  // Count carousel images that have a real currentSrc
  const imgCount = await page.evaluate(() => {
    const galleries = Array.from(document.querySelectorAll('.media-gallery'));
    let total = 0, loaded = 0;
    galleries.forEach((g) => {
      g.querySelectorAll('img').forEach((img) => {
        total++;
        const cs = img.currentSrc || '';
        if (cs && !/^data:/.test(cs) && img.naturalWidth > 4) loaded++;
      });
    });
    return { total, loaded };
  });

  await page.screenshot({ path: `/tmp/w11/v2-${label}-full.png`, fullPage: true });
  await browser.close();
  return { state, imgCount };
}

const dev = await probe(URLS.dev, 'dev');
const preview = await probe(URLS.preview, 'preview');

console.log('\n=== DEV ===');
console.log('tv slide0:', dev.state.tvSlide0);
console.log('fam slide0:', dev.state.famSlide0);
console.log('carousel img:', dev.imgCount);
console.log('TV slide styles applied:', dev.state.tvSlides.filter((s) => s.hasStyle).length, '/', dev.state.tvSlides.length);
console.log('FAM slide styles applied:', dev.state.famSlides.filter((s) => s.hasStyle).length, '/', dev.state.famSlides.length);

console.log('\n=== PREVIEW ===');
console.log('tv slide0:', preview.state.tvSlide0);
console.log('fam slide0:', preview.state.famSlide0);
console.log('carousel img:', preview.imgCount);
console.log('TV slide styles applied:', preview.state.tvSlides.filter((s) => s.hasStyle).length, '/', preview.state.tvSlides.length);
console.log('FAM slide styles applied:', preview.state.famSlides.filter((s) => s.hasStyle).length, '/', preview.state.famSlides.length);

// Pixel diff
const a = PNG.sync.read(readFileSync('/tmp/w11/v2-dev-full.png'));
const b = PNG.sync.read(readFileSync('/tmp/w11/v2-preview-full.png'));
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
console.log(`\nPIXEL DIFF dev vs preview: ${differing}/${total} = ${(100 * (1 - differing/total)).toFixed(4)}%`);
const windows = [];
for (let y = 0; y < H; y += 200) {
  let s = 0; for (let yy = y; yy < y+200 && yy < H; yy++) s += rowDiffs[yy];
  if (s > 0) windows.push({ y0: y, y1: Math.min(y+200, H), diff: s });
}
windows.sort((a, b) => b.diff - a.diff);
for (const w of windows.slice(0, 5)) {
  console.log(`  y=${w.y0}..${w.y1}  diff=${w.diff}`);
}
