// Deeper inspection — focus on .media-gallery slides, dump full DOM per slide
// and screenshot the carousel area in both dev and preview.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const URLS = {
  dev: 'http://localhost:5174/',
  preview: 'http://localhost:4173/',
};

mkdirSync('/tmp/w11', { recursive: true });

async function inspect(url, label) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleMsgs = [];
  page.on('pageerror', (e) => consoleMsgs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleMsgs.push('console: ' + m.text()); });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => consoleMsgs.push('goto: ' + e.message));

  // Slow scroll, lots of time to wake lazy
  const totalScroll = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < totalScroll + 2000; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // Pin media-gallery and walk its descendants
  const galleryDump = await page.evaluate(() => {
    const gals = Array.from(document.querySelectorAll('.media-gallery'));
    return gals.map((g, gi) => {
      // Find slide-like children: anything with picture or img descendants
      const slides = Array.from(g.querySelectorAll('.gallery-item, [class*="slide"], [class*="Slide"], [class*="item"], li'));
      const pictures = Array.from(g.querySelectorAll('picture'));
      const imgs = Array.from(g.querySelectorAll('img'));
      return {
        idx: gi,
        cls: g.className,
        rect: (() => { const r = g.getBoundingClientRect(); return { top: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; })(),
        slideCount: slides.length,
        pictureCount: pictures.length,
        imgCount: imgs.length,
        pictureHtml: pictures.slice(0, 4).map((p) => p.outerHTML.slice(0, 2000)),
        imgInfo: imgs.slice(0, 12).map((img) => {
          const r = img.getBoundingClientRect();
          return {
            currentSrc: (img.currentSrc || '').slice(0, 250),
            src: (img.getAttribute('src') || '').slice(0, 250),
            srcset: (img.getAttribute('srcset') || '').slice(0, 250),
            naturalW: img.naturalWidth,
            naturalH: img.naturalHeight,
            displayW: Math.round(r.width),
            displayH: Math.round(r.height),
            complete: img.complete,
            outerStart: img.outerHTML.slice(0, 300),
            parentTag: img.parentElement?.tagName,
            parentAttrs: img.parentElement ? Array.from(img.parentElement.attributes).map((a) => a.name + '=' + a.value.slice(0, 60)).join(' | ') : '',
          };
        }),
      };
    });
  });

  // Try to navigate to first .media-gallery
  await page.evaluate(() => {
    const g = document.querySelector('.media-gallery');
    if (g) g.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(800);

  await page.screenshot({ path: `/tmp/w11/${label}-gallery.png`, fullPage: false });

  await browser.close();
  return { label, url, galleryDump, consoleMsgs: consoleMsgs.slice(0, 30) };
}

const results = {};
for (const [k, url] of Object.entries(URLS)) {
  console.log(`Inspecting ${k}...`);
  results[k] = await inspect(url, k);
}

writeFileSync('/tmp/w11/deep.json', JSON.stringify(results, null, 2));

// Print key diff
for (const [k, r] of Object.entries(results)) {
  console.log(`\n=== ${k} ===`);
  console.log('errors:', r.consoleMsgs.slice(0, 5));
  for (const g of r.galleryDump) {
    console.log(`  gallery[${g.idx}] cls="${g.cls}" pic=${g.pictureCount} img=${g.imgCount} slides=${g.slideCount}`);
    let lazyCount = 0, realCount = 0;
    for (const i of g.imgInfo) {
      const real = i.currentSrc && !/^data:/.test(i.currentSrc) && i.naturalW > 4;
      if (real) realCount++; else lazyCount++;
    }
    console.log(`    real=${realCount} lazy=${lazyCount}`);
    if (g.imgInfo.length > 0) {
      console.log('    sample img[0]:');
      console.log('      currentSrc:', g.imgInfo[0].currentSrc.slice(0, 120));
      console.log('      src:', g.imgInfo[0].src.slice(0, 120));
      console.log('      naturalW/H:', g.imgInfo[0].naturalW, g.imgInfo[0].naturalH);
      console.log('      parent:', g.imgInfo[0].parentTag, '[', g.imgInfo[0].parentAttrs.slice(0, 200), ']');
      console.log('      outerStart:', g.imgInfo[0].outerStart);
    }
    if (g.pictureHtml.length > 0) {
      console.log('    sample picture[0]:');
      console.log('     ', g.pictureHtml[0].slice(0, 800));
    }
  }
}
console.log('\nScreenshots: /tmp/w11/dev-gallery.png /tmp/w11/preview-gallery.png');
console.log('Full dump: /tmp/w11/deep.json');
