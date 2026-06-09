import { chromium } from 'playwright';
(async () => {
  const ctx = await chromium.launchPersistentContext('/Users/cameronmcallister/.config/playwright-clickup', {
    channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block', args: ['--disable-blink-features=AutomationControlled'], ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.goto('https://app.clickup.com/90152566819/v/l/2kyr6013-855', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  await page.getByLabel('Group', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1200);
  const res = await page.evaluate(() => {
    const VIEWPORT = window.innerWidth * window.innerHeight;
    const sizeOf = (el: Element) => { const r = (el as HTMLElement).getBoundingClientRect(); return { w: r.width, h: r.height, a: r.width*r.height }; };
    const visible = (el: Element) => { const cs = getComputedStyle(el as HTMLElement); return !(cs.visibility==='hidden'||cs.display==='none'||Number(cs.opacity)<0.05); };
    const containers = Array.from(document.querySelectorAll('.cdk-overlay-pane, .ReactModalPortal, body > div[class*="overlay"]'));
    const hits: any[] = [];
    for (const cont of containers) {
      for (const el of Array.from(cont.querySelectorAll('*'))) {
        if (!visible(el)) continue;
        const cls=(el.className||'').toString();
        if (/backdrop|focus-trap-anchor|visually-hidden/.test(cls)) continue;
        const {w,h,a}=sizeOf(el);
        if (w<100||h<30) continue;
        if (a>VIEWPORT*0.85) continue;
        hits.push({cls: cls.slice(0,60), w:Math.round(w), h:Math.round(h)});
      }
    }
    return { containers: containers.length, hits: hits.slice(0,15) };
  });
  console.log('CONTAINERS', res.containers);
  for (const h of res.hits) console.log(JSON.stringify(h));
  await ctx.close();
})().catch(e=>{console.error(e);process.exit(1);});
