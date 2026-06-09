import { chromium } from 'playwright';
import * as fs from 'fs';

const OUT = '/Users/cameronmcallister/Github/dr-parity/docs/research/crawl/app.clickup.com/2026-06-01-home-deep';
const BASE = 'https://app.clickup.com/90152566819/home';

async function main() {
  const ctx = await chromium.launchPersistentContext('/Users/cameronmcallister/.config/playwright-clickup', {
    channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(()=>{});
  await page.waitForTimeout(2500);

  console.log('URL:', page.url());

  // Dump the sidebar (Home secondary panel) clickable items
  const dump = await page.evaluate(() => {
    const out: any[] = [];
    // try the global sidebar container
    const containers = Array.from(document.querySelectorAll('div.cu-global-sidebar__container, nav, [data-test*="sidebar"], aside'));
    const sidebar = containers.find(c => (c as HTMLElement).offsetWidth > 180 && (c as HTMLElement).offsetWidth < 420 && (c as HTMLElement).offsetHeight > 400);
    const root = sidebar || document.body;
    const els = Array.from(root.querySelectorAll('a, button, [role="button"], [role="treeitem"], [role="menuitem"]'));
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.x > 380) continue; // only sidebar column
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      out.push({
        tag: el.tagName.toLowerCase(),
        text: t,
        aria: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
        href: (el as HTMLAnchorElement).href || '',
        dtest: el.getAttribute('data-test') || el.getAttribute('data-testid') || '',
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      });
    }
    return { sidebarFound: !!sidebar, sidebarW: sidebar ? (sidebar as HTMLElement).offsetWidth : 0, items: out };
  });

  fs.writeFileSync(OUT + '/home-sidebar-dump.json', JSON.stringify(dump, null, 2));
  console.log('sidebarFound:', dump.sidebarFound, 'width:', dump.sidebarW, 'items:', dump.items.length);
  await page.screenshot({ path: OUT + '/_discover-home.png' });

  await ctx.close();
  console.log('done');
}
main().catch(e => { console.error(e); process.exit(1); });
