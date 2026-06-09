import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'tooling/parity-harness/output/home-menus-2026-06-01';
const URL = 'http://localhost:4280/90152566819/home';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

async function closeAll() {
  for (let i = 0; i < 4; i++) {
    if ((await page.locator('[role="menu"]:visible').count()) === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
}

async function shot(name, selector) {
  await closeAll();
  try {
    const trigger = page.locator(selector).first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.waitForTimeout(280);
    const menu = page.locator('[role="menu"]:visible').last();
    await menu.waitFor({ state: 'visible', timeout: 2500 });
    const box = await menu.boundingBox();
    const pad = 6;
    await page.screenshot({
      path: `${OUT}/${name}.png`,
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      },
    });
    console.log(`OK   ${name}  ${Math.round(box.width)}x${Math.round(box.height)}`);
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: `${OUT}/${name}-FAIL.png` });
  }
}

await shot('home-header-plus', 'button[aria-label="Create"]');
await shot('menu-my-tasks-more', 'button[aria-haspopup="menu"]:has-text("More")');
await shot('menu-favorites-plus', 'button[aria-label="Favorites options"]');
await shot('menu-channels-plus', 'button[aria-label="Channels options"]');
await shot('menu-direct-messages-plus', 'button[aria-label="Direct Messages options"]');
await shot('menu-spaces-plus', 'button[aria-label="Spaces options"]');
await shot('menu-add-channel', 'button[aria-haspopup="menu"]:has-text("Add Channel")');

await browser.close();
console.log('done');
