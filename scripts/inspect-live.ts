import { chromium } from 'playwright';
async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4500); // let interactivity hook fire
  // For each overlay trigger in the manifest, simulate the resolver in-page
  const result = await page.evaluate(async () => {
    const res = await fetch('/src/interactions/index/manifest.json').catch(() => null);
    return { fetchOk: !!res };
  });
  console.log('manifest fetch:', result);
  // Try clicking known important elements by visible characteristic
  // (a) Krevio Owner chevron — small icon near top of sidebar
  // (b) "+" add source plus button
  // (c) top-bar calendar icon
  const probes = await page.evaluate(() => {
    const results: any[] = [];
    // Krevio chevron (small icon near (217,117))
    const cx = 217, cy = 117;
    const nearby = Array.from(document.body.querySelectorAll('button, [aria-haspopup], [data-state="closed"]'));
    for (const el of nearby) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0) continue;
      const ecx = r.x + r.width/2;
      const ecy = r.y + r.height/2;
      if (Math.abs(ecx - cx) < 60 && Math.abs(ecy - cy) < 60) {
        results.push({ tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), hasPopup: el.hasAttribute('aria-haspopup'), state: el.getAttribute('data-state') });
      }
    }
    return results.slice(0, 10);
  });
  console.log('Buttons near Krevio chevron:');
  probes.forEach((p: any) => console.log('  ', JSON.stringify(p)));
  await browser.close();
}
main();
