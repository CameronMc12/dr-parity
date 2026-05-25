import { chromium } from 'playwright';

const BASE = 'http://localhost:5174';
const ROUTES: { name: string; path: string }[] = [
  { name: 'inbox', path: '/90152566819/inbox?tab=primary' },
  { name: 'list', path: '/90152566819/v/l/2kyr6013-415' },
];

async function checkRoute(
  browser: import('playwright').Browser,
  route: { name: string; path: string },
): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  let failed = 0;
  const failedUrls: string[] = [];
  page.on('requestfailed', (req) => {
    failed++;
    if (failedUrls.length < 8) failedUrls.push(`${req.failure()?.errorText ?? '?'} ${req.url()}`);
  });

  await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const sheetCount = await page.evaluate(() => document.styleSheets.length);

  // Sprite resolution: count <use> refs whose target #cu3-icon-X exists in document.
  const iconReport = await page.evaluate(() => {
    const uses = Array.from(document.querySelectorAll('use'));
    let withRef = 0;
    let resolved = 0;
    let firstResolvedId = '';
    let firstResolvedHasGeometry = false;
    for (const u of uses) {
      const href =
        u.getAttribute('xlink:href') || u.getAttribute('href') || '';
      if (!href.startsWith('#cu3-icon-')) continue;
      withRef++;
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (target) {
        resolved++;
        if (!firstResolvedId) {
          firstResolvedId = id;
          firstResolvedHasGeometry =
            target.querySelector('path, rect, circle, polygon, line, g') !== null;
        }
      }
    }
    const spriteSymbols = document.querySelectorAll(
      'svg[data-dr-parity-sprite] symbol[id^="cu3-icon-"]',
    ).length;
    return { withRef, resolved, firstResolvedId, firstResolvedHasGeometry, spriteSymbols };
  });

  console.log(`\n=== ${route.name} (${route.path}) ===`);
  console.log(`  document.styleSheets: ${sheetCount}`);
  console.log(`  failed requests (net::ERR_*): ${failed}`);
  if (failedUrls.length > 0) console.log(`  sample failures:\n    ${failedUrls.join('\n    ')}`);
  console.log(`  injected sprite symbols (#cu3-icon-*): ${iconReport.spriteSymbols}`);
  console.log(`  <use #cu3-icon-*> refs on page: ${iconReport.withRef}`);
  console.log(`  refs resolving to an in-document symbol: ${iconReport.resolved}`);
  console.log(
    `  first resolved icon: ${iconReport.firstResolvedId || '(none)'} hasGeometry=${iconReport.firstResolvedHasGeometry}`,
  );

  await page.screenshot({ path: `/tmp/clickup-assets-${route.name}.png`, fullPage: false });
  console.log(`  screenshot: /tmp/clickup-assets-${route.name}.png`);

  await context.close();
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  for (const route of ROUTES) await checkRoute(browser, route);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
