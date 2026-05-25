// Survey EVERY picture on the page and find any whose img is still on the data-URI placeholder.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('/tmp/w11', { recursive: true });
const URLS = { dev: 'http://localhost:5174/', preview: 'http://localhost:4173/' };

async function inspect(url, label) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});

  // Slow scroll through to wake lazy load
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h + 2000; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));

  const data = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const survey = imgs.map((img, i) => {
      const r = img.getBoundingClientRect();
      const cs = img.currentSrc || '';
      const isPlaceholder = /^data:image/i.test(cs) || cs === '';
      return {
        i,
        currentSrc: cs.slice(0, 200),
        isPlaceholder,
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        displayW: Math.round(r.width),
        displayH: Math.round(r.height),
        complete: img.complete,
        loading: img.loading,
        alt: (img.alt || '').slice(0, 60),
        parentCls: img.parentElement?.className || '',
        parentTag: img.parentElement?.tagName,
        ancestorWithGallery: (() => {
          let p = img.parentElement;
          while (p) {
            const c = (p.className || '').toString();
            if (/gallery|carousel|slide/i.test(c)) return c.slice(0, 100);
            p = p.parentElement;
          }
          return null;
        })(),
        outerStart: img.outerHTML.slice(0, 400),
      };
    });

    const placeholders = survey.filter((s) => s.isPlaceholder);
    const inGallery = survey.filter((s) => s.ancestorWithGallery);
    const inGalleryPlaceholder = inGallery.filter((s) => s.isPlaceholder);
    return {
      totalImg: survey.length,
      placeholderCount: placeholders.length,
      placeholders: placeholders.slice(0, 30),
      inGalleryCount: inGallery.length,
      inGalleryPlaceholderCount: inGalleryPlaceholder.length,
      inGalleryPlaceholderSamples: inGalleryPlaceholder.slice(0, 10),
    };
  });

  await browser.close();
  return { label, ...data };
}

const out = {};
for (const [k, u] of Object.entries(URLS)) {
  console.log('Surveying', k);
  out[k] = await inspect(u, k);
}
writeFileSync('/tmp/w11/allpic.json', JSON.stringify(out, null, 2));

for (const [k, r] of Object.entries(out)) {
  console.log(`\n=== ${k} ===`);
  console.log('  total imgs:', r.totalImg);
  console.log('  placeholders:', r.placeholderCount);
  console.log('  in-gallery imgs:', r.inGalleryCount);
  console.log('  in-gallery placeholders:', r.inGalleryPlaceholderCount);
  if (r.inGalleryPlaceholderSamples.length > 0) {
    console.log('  -- in-gallery placeholder samples:');
    for (const s of r.inGalleryPlaceholderSamples.slice(0, 5)) {
      console.log(`     parentCls=${s.parentCls} ancestor=${s.ancestorWithGallery}`);
      console.log(`     currentSrc=${s.currentSrc}`);
      console.log(`     outer=${s.outerStart.slice(0, 250)}`);
    }
  }
  if (r.placeholders.length > 0) {
    console.log('  -- any placeholder samples:');
    for (const s of r.placeholders.slice(0, 5)) {
      console.log(`     parentCls=${s.parentCls} ancestor=${s.ancestorWithGallery || '-'}`);
      console.log(`     currentSrc=${s.currentSrc}`);
      console.log(`     outer=${s.outerStart.slice(0, 250)}`);
    }
  }
}
console.log('\nFull: /tmp/w11/allpic.json');
