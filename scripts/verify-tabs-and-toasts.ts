/**
 * Verify: tab-swap on /approval (click "Approved by me") + demo-toast on /
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

  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200));
  });

  // -------- 1. Approval tab swap --------
  await page.goto('http://localhost:5173/approval.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(OUT, 'approval-baseline.png'), fullPage: false });

  // Capture baseline body length
  const beforeLen = await page.evaluate(() => document.body.innerText.length);
  console.log('Approval baseline body text length:', beforeLen);

  // Click "Approved by me"
  const clicked = await page.evaluate(() => {
    const target = Array.from(document.querySelectorAll('*'))
      .find((el) => el.children.length === 0 && (el.textContent || '').trim() === 'Approved by me');
    if (!target) return null;
    let cur: Element | null = target;
    for (let i = 0; i < 6 && cur; i++) {
      const cs = getComputedStyle(cur);
      if (cs.cursor === 'pointer' || cur.hasAttribute('role') && cur.getAttribute('role') === 'tab') {
        const r = (cur as HTMLElement).getBoundingClientRect();
        return { tag: cur.tagName, rect: { x: r.x + r.width / 2, y: r.y + r.height / 2 } };
      }
      cur = cur.parentElement;
    }
    return null;
  });
  console.log('Approved by me target:', clicked);
  if (clicked) {
    await page.mouse.click(clicked.rect.x, clicked.rect.y);
    await page.waitForTimeout(700); // tab swap + framer-motion
    await page.screenshot({ path: join(OUT, 'approval-after-tab-swap.png'), fullPage: false });
    const afterLen = await page.evaluate(() => document.body.innerText.length);
    console.log('Approval after-swap body text length:', afterLen, '(diff:', afterLen - beforeLen, ')');
  }

  // -------- 2. Demo toast on dashboard --------
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4000);

  // Find any visible button with text — try "Create post"
  const createBtn = await page.evaluate(() => {
    const target = Array.from(document.querySelectorAll('button'))
      .find((el) => (el.textContent || '').trim().toLowerCase().includes('create post'));
    if (!target) return null;
    const r = (target as HTMLElement).getBoundingClientRect();
    return { rect: { x: r.x + r.width / 2, y: r.y + r.height / 2 } };
  });
  console.log('Create post button:', createBtn);
  if (createBtn) {
    await page.mouse.click(createBtn.rect.x, createBtn.rect.y);
    await page.waitForTimeout(500); // toast slide-in
    await page.screenshot({ path: join(OUT, 'dashboard-after-create-post.png'), fullPage: false });
    // Check for visible toast element in DOM
    const toastCount = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('*'))
        .filter((el) => {
          const t = (el.textContent || '').trim();
          return t.startsWith('[demo]') || t.includes('demo');
        });
      return candidates.length;
    });
    console.log('Toast-bearing elements found:', toastCount);
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
