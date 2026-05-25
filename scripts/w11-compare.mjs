// Compare carousel DOM between dev and preview to find Shape C.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URLS = {
  dev: 'http://localhost:5174/',
  preview: 'http://localhost:4173/',
};

async function inspect(url, label) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  // Scroll all the way through to wake lazy
  for (let y = 0; y < 12000; y += 600) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);

  // Hunt for galleries
  const galleries = await page.evaluate(() => {
    const sels = ['.gallery-rich', '[data-component-name="GalleryRichmond"]', '.media-gallery', '[class*="gallery"]', '[class*="Gallery"]'];
    const hits = {};
    for (const s of sels) {
      hits[s] = document.querySelectorAll(s).length;
    }
    return hits;
  });

  // Pick the broadest selector and dump pictures inside
  const carouselData = await page.evaluate(() => {
    const containers = document.querySelectorAll('[class*="gallery"], [class*="Gallery"], .media-gallery, [data-component-name*="Gallery"]');
    const out = [];
    containers.forEach((c, idx) => {
      const pics = c.querySelectorAll('picture, img');
      const summary = {
        idx,
        tag: c.tagName,
        cls: (c.className || '').toString().slice(0, 200),
        component: c.getAttribute('data-component-name') || '',
        picCount: c.querySelectorAll('picture').length,
        imgCount: c.querySelectorAll('img').length,
        samples: [],
      };
      const sampleEls = Array.from(pics).slice(0, 4);
      for (const el of sampleEls) {
        const rect = el.getBoundingClientRect();
        const html = el.outerHTML.slice(0, 1500);
        let currentSrc = '';
        if (el.tagName === 'IMG') currentSrc = el.currentSrc || el.src || '';
        else {
          const img = el.querySelector('img');
          if (img) currentSrc = img.currentSrc || img.src || '';
        }
        summary.samples.push({
          tag: el.tagName,
          rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
          currentSrc: currentSrc.slice(0, 200),
          html,
        });
      }
      out.push(summary);
    });
    return out;
  });

  // Count blank vs loaded carousel images
  const counts = await page.evaluate(() => {
    const containers = document.querySelectorAll('[class*="gallery"], [class*="Gallery"], .media-gallery, [data-component-name*="Gallery"]');
    let totalImg = 0, loaded = 0, blank = 0;
    const blanks = [];
    containers.forEach((c) => {
      c.querySelectorAll('img').forEach((img) => {
        totalImg++;
        const cs = (img.currentSrc || img.src || '');
        const isGif1x1 = /^data:image\/gif/i.test(cs) || cs === '';
        if (img.complete && img.naturalWidth > 2 && !isGif1x1) loaded++;
        else { blank++; blanks.push({ src: cs.slice(0,200), alt: img.alt, outer: img.outerHTML.slice(0, 600) }); }
      });
    });
    return { totalImg, loaded, blank, blanks: blanks.slice(0, 10) };
  });

  await browser.close();
  return { label, url, galleries, carouselData, counts };
}

const results = {};
for (const [k, url] of Object.entries(URLS)) {
  console.log(`Inspecting ${k} ${url}...`);
  try {
    results[k] = await inspect(url, k);
  } catch (e) {
    results[k] = { error: e.message };
  }
}

writeFileSync('/tmp/w11-compare.json', JSON.stringify(results, null, 2));
console.log('\n=== SUMMARY ===');
for (const [k, r] of Object.entries(results)) {
  if (r.error) { console.log(`${k}: ERROR ${r.error}`); continue; }
  console.log(`\n${k}:`);
  console.log('  galleries hit:', JSON.stringify(r.galleries));
  console.log('  carousel containers:', r.carouselData.length);
  console.log('  counts:', JSON.stringify(r.counts.totalImg) + ' total, ' + r.counts.loaded + ' loaded, ' + r.counts.blank + ' blank');
  if (r.counts.blanks.length > 0) {
    console.log('  first blank img sample:');
    console.log('    outer:', r.counts.blanks[0].outer.slice(0, 400));
  }
}
console.log('\nFull dump: /tmp/w11-compare.json');
