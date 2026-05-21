import { chromium } from 'playwright';
import { join } from 'node:path';

const OUT = '/Users/cameronmcallister/Github/omnichannel-clone/docs/verify-clone';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4000);

  // Click "Upgrade plan" button (the bottom-left black pill — demo kind in manifest)
  await page.mouse.click(127, 700); // rect.x+w/2, rect.y+h/2 for t-6 Upgrade plan
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'dashboard-toast-upgrade.png'), fullPage: false });

  // Check if a toast element exists in the DOM
  const toastFound = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const matches = all.filter((el) => {
      const t = (el.textContent || '').trim();
      return el.children.length === 0 && (t.startsWith('[demo]') || t.includes('demo'));
    });
    return matches.length > 0 ? matches[0].textContent : null;
  });
  console.log('Toast text:', toastFound);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
