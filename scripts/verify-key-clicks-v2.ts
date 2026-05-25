import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '/Users/cameronmcallister/Github/omnichannel-clone/docs/verify-clone';

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: join(OUT, 'kv2-baseline.png'), fullPage: false });

  // 1. Workspace switcher chevron (the actual aria-haspopup button at ~221,117)
  await page.mouse.click(221, 117);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, 'kv2-workspace-switcher.png'), fullPage: false });
  const w1 = await page.locator('[role="menu"][data-state="open"], [role="dialog"][data-state="open"]').count();
  console.log('Workspace switcher: open overlays =', w1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 2. Click top-bar calendar icon (small icon top-left of calendar header, ~285,25)
  await page.mouse.click(285, 25);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, 'kv2-top-calendar.png'), fullPage: false });
  const c1 = await page.locator('[role="menu"][data-state="open"], [role="dialog"][data-state="open"]').count();
  console.log('Top calendar icon: open overlays =', c1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 3. Settings cog icon top-left (~35, 117)
  await page.mouse.click(35, 117);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, 'kv2-settings-cog.png'), fullPage: false });
  const s1 = await page.locator('[role="menu"][data-state="open"], [role="dialog"][data-state="open"]').count();
  console.log('Settings cog: open overlays =', s1);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
