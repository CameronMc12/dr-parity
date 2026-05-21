/**
 * Exercise the clone: open a dropdown on /posts, take before/after screenshots,
 * also confirm the Inter font has actually loaded (not a fallback).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '/Users/cameronmcallister/Github/omnichannel-clone/docs/verify-clone';

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 1. /posts — closed state
  await page.goto('http://localhost:5173/posts.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(OUT, 'posts-closed.png'), fullPage: false });

  // 2. font check — sample the body's computed font-family
  const fontInfo = await page.evaluate(() => {
    const sample = document.querySelector('h1, h2, h3, button, a') || document.body;
    const cs = getComputedStyle(sample);
    const ff = cs.fontFamily;
    // also check if any @font-face source has actually loaded
    const loadedFonts: string[] = [];
    if ((document as any).fonts?.forEach) {
      ((document as any).fonts as Set<FontFace>).forEach((f) => {
        if (f.status === 'loaded') loadedFonts.push(`${f.family} ${f.weight}`);
      });
    }
    return { fontFamily: ff, loadedFonts: loadedFonts.slice(0, 12) };
  });
  console.log('FONT:', JSON.stringify(fontInfo, null, 2));

  // 3. click the "All Status" filter trigger and screenshot
  // Find it by accessible text
  try {
    const trigger = page.locator('button:has-text("All Status")').first();
    await trigger.waitFor({ state: 'visible', timeout: 5000 });
    const box = await trigger.boundingBox();
    console.log('TRIGGER rect:', box);
    await trigger.click();
    await page.waitForTimeout(400); // give framer-motion entrance time
    await page.screenshot({ path: join(OUT, 'posts-open-all-status.png'), fullPage: false });
    console.log('CLICK: ok');

    // count visible menus
    const menuCount = await page.locator('[role="menu"][data-state="open"], [data-state="open"][role="dialog"]').count();
    console.log('OPEN MENUS:', menuCount);
  } catch (err) {
    console.log('CLICK FAIL:', (err as Error).message);
  }

  // 4. press Escape, screenshot closed again
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, 'posts-closed-after.png'), fullPage: false });

  // 5. Check console messages for errors
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // wait briefly to capture any tail errors
  await page.waitForTimeout(500);
  console.log('PAGE ERRORS:', errors.slice(0, 5));

  // 6. Try the user menu (Cameron McAllister) on dashboard
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(OUT, 'dashboard-closed.png'), fullPage: false });
  try {
    const userTrigger = page.locator('button:has-text("Cameron McAlli")').first();
    await userTrigger.click({ timeout: 3000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, 'dashboard-open-user-menu.png'), fullPage: false });
    console.log('USER MENU: clicked');
  } catch (err) {
    console.log('USER MENU FAIL:', (err as Error).message);
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
