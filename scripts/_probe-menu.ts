import { chromium } from 'playwright';

(async () => {
  const ctx = await chromium.launchPersistentContext('/Users/cameronmcallister/.config/playwright-clickup', {
    channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block', args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.goto('https://app.clickup.com/90152566819/v/l/2kyr6013-855', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  async function dump(label: string) {
    const info = await page.evaluate(() => {
      const out: any[] = [];
      const roots = document.querySelectorAll('.cdk-overlay-pane, .ReactModalPortal, body > div[class*="overlay"]');
      roots.forEach((p) => {
        const r = (p as HTMLElement).getBoundingClientRect();
        const cs = getComputedStyle(p as HTMLElement);
        // dump immediate meaningful descendants too
        const firstChild = p.firstElementChild as HTMLElement | null;
        out.push({
          tag: p.tagName, cls: (p.className || '').toString().slice(0, 80),
          w: Math.round(r.width), h: Math.round(r.height), vis: cs.visibility, disp: cs.display, op: cs.opacity,
          childCls: firstChild ? (firstChild.className || '').toString().slice(0, 80) : '',
          dt: (p.querySelector('[data-test]') as HTMLElement)?.getAttribute('data-test') || '',
          items: p.querySelectorAll('[class*="dropdown-list-item"], [role="menuitem"], [role="option"], button, li').length,
        });
      });
      return out;
    });
    console.log(`\n=== ${label} ===`);
    for (const i of info) console.log(JSON.stringify(i));
  }

  // open Group menu
  await page.getByLabel('Group', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1200);
  await dump('GROUP menu open');
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);

  // open priority on a row placeholder
  await page.locator('[data-test="task-row__priority-placeholder"]').first().click({ force: true });
  await page.waitForTimeout(1200);
  await dump('PRIORITY menu open');
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);

  await ctx.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
