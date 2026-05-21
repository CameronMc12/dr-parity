/**
 * Click the user-mentioned buttons and screenshot each result.
 * Focus areas:
 *   - Krevio Owner workspace dropdown
 *   - Cameron McAlli user menu
 *   - Top calendar/calendar-icon dropdown
 *   - "+" add source button next to Facebook icon
 *   - Notifications icon
 *   - Approval > "Approved by me" tab
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '/Users/cameronmcallister/Github/omnichannel-clone/docs/verify-clone';

async function clickByText(page: Page, text: string): Promise<boolean> {
  return page.evaluate((t) => {
    const target = Array.from(document.querySelectorAll('*'))
      .find((el) => el.children.length === 0 && (el.textContent || '').trim() === t);
    if (!target) return false;
    let cur: Element | null = target;
    for (let i = 0; i < 6 && cur; i++) {
      const cs = getComputedStyle(cur);
      if (cs.cursor === 'pointer' || (cur as HTMLElement).onclick != null) {
        (cur as HTMLElement).click();
        return true;
      }
      cur = cur.parentElement;
    }
    return false;
  }, text);
}

async function clickByRect(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.click(x, y);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // --- Dashboard checks ---
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(OUT, 'k-dashboard-baseline.png'), fullPage: false });

  // 1. Click the Krevio Owner chevron - this is the workspace switcher
  // From v1 manifest: text was "Cameron McAllister" for both Krevio and User menu... but rect distinguishes
  // Try clicking around (220, 130) where the chevron icon was
  await clickByRect(page, 220, 130);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, 'k-workspace-switcher.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 2. Click top-bar calendar icon (rect[272,12] no text overlay from v3)
  await clickByRect(page, 285, 25);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, 'k-top-calendar-icon.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 3. Click the "+" add source button (small + next to Facebook icon at around x=100, y=215)
  await clickByRect(page, 99, 215);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, 'k-add-source-plus.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 4. Click Create post big black button (approximate rect)
  await clickByRect(page, 127, 268);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, 'k-create-post.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 5. Click "Notifications" in sidebar (around y=757)
  await clickByRect(page, 90, 757);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, 'k-notifications.png'), fullPage: false });

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
