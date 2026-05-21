import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '/Users/cameronmcallister/Github/omnichannel-clone/docs/verify-clone';

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console.' + m.type() + ']', m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await page.goto('http://localhost:5173/posts.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4500); // let everything settle + interactivity wire up

  // Click any element whose visible text is exactly "All Status" — robust to tag type
  const found = await page.evaluate(() => {
    const target = Array.from(document.querySelectorAll('*'))
      .find((el) => el.children.length === 0 && (el.textContent || '').trim() === 'All Status');
    if (!target) return null;
    // walk up to the most likely clickable ancestor (the captured trigger)
    let cur: Element | null = target;
    for (let i = 0; i < 6 && cur; i++) {
      const rect = (cur as HTMLElement).getBoundingClientRect();
      const cs = getComputedStyle(cur);
      if (cs.cursor === 'pointer' || (cur as HTMLElement).onclick != null || cur.hasAttribute('aria-haspopup')) {
        return { tag: cur.tagName, rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, hasAriaHas: cur.hasAttribute('aria-haspopup') };
      }
      cur = cur.parentElement;
    }
    return { tag: 'NONE_CLICKABLE_FOUND' };
  });
  console.log('Trigger found:', found);

  if (found && (found as any).rect) {
    const r = (found as any).rect;
    // click at center of trigger
    await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
    await page.waitForTimeout(450);
    await page.screenshot({ path: join(OUT, 'posts-open-all-status.png'), fullPage: false });

    const openCount = await page.locator('[role="menu"][data-state="open"]').count();
    console.log('Open menu count after click:', openCount);
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
