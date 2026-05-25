// Capture full page screenshots dev vs preview, also dump the gallery slide structure
// to find lazy/visibility differences.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('/tmp/w11', { recursive: true });
const URLS = { dev: 'http://localhost:5174/', preview: 'http://localhost:4173/' };

async function snap(url, label) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});

  // Slow scroll
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h + 2000; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // Full page screenshot
  await page.screenshot({ path: `/tmp/w11/${label}-fullpage.png`, fullPage: true });

  // Inspect TV gallery slides specifically
  const tvSlides = await page.evaluate(() => {
    const tv = document.querySelector('.tv-media-gallery');
    if (!tv) return null;
    const r = tv.getBoundingClientRect();
    const slides = Array.from(tv.querySelectorAll('.media-gallery-item, .gallery-item, [class*="slide"], li'));
    return {
      tvRect: { top: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      slideCount: slides.length,
      slides: slides.slice(0, 15).map((s, i) => {
        const sr = s.getBoundingClientRect();
        const img = s.querySelector('img');
        return {
          i,
          cls: (s.className || '').toString(),
          rect: { w: Math.round(sr.width), h: Math.round(sr.height) },
          visible: sr.width > 0 && sr.height > 0,
          imgSrc: img ? (img.currentSrc || img.src || '').slice(0, 200) : null,
          imgNatW: img ? img.naturalWidth : null,
          imgComplete: img ? img.complete : null,
          dataAttrs: Array.from(s.attributes).filter((a) => a.name.startsWith('data-')).map((a) => a.name + '=' + a.value.slice(0, 60)).join('|'),
          inlineStyle: s.getAttribute('style') || '',
        };
      }),
    };
  });

  // Look for "Endless entertainment" section in detail
  const heroSection = await page.evaluate(() => {
    // Find by text
    const allEls = document.querySelectorAll('*');
    let entSection = null;
    for (const el of allEls) {
      if (el.children.length === 0 && el.textContent.trim() === 'Endless entertainment.') {
        let p = el;
        for (let i = 0; i < 8 && p; i++) {
          if (p.tagName === 'SECTION' || p.classList?.contains('section') || p.id?.includes('tv')) { entSection = p; break; }
          p = p.parentElement;
        }
        break;
      }
    }
    if (!entSection) return null;
    const rect = entSection.getBoundingClientRect();
    return {
      tag: entSection.tagName,
      cls: entSection.className,
      id: entSection.id,
      h: Math.round(rect.height),
      w: Math.round(rect.width),
      childTags: Array.from(entSection.children).map((c) => `${c.tagName}.${c.className.toString().slice(0,50)}`),
      pictureCount: entSection.querySelectorAll('picture').length,
      imgCount: entSection.querySelectorAll('img').length,
      videoCount: entSection.querySelectorAll('video').length,
    };
  });

  await browser.close();
  return { label, url, tvSlides, heroSection };
}

const out = {};
for (const [k, u] of Object.entries(URLS)) {
  console.log('Snapping', k);
  out[k] = await snap(u, k);
}
writeFileSync('/tmp/w11/fullpage.json', JSON.stringify(out, null, 2));

for (const [k, r] of Object.entries(out)) {
  console.log(`\n=== ${k} ===`);
  console.log('  Endless ent section:', JSON.stringify(r.heroSection, null, 2));
  if (r.tvSlides) {
    console.log('  TV gallery rect:', r.tvSlides.tvRect);
    console.log('  Slide count:', r.tvSlides.slideCount);
    for (const s of r.tvSlides.slides) {
      console.log(`    slide[${s.i}] cls="${s.cls.slice(0,60)}" rect=${s.rect.w}x${s.rect.h} imgNatW=${s.imgNatW} imgComplete=${s.imgComplete}`);
      console.log(`              dataAttrs=${s.dataAttrs.slice(0,200)} style="${s.inlineStyle.slice(0,100)}"`);
    }
  }
}
