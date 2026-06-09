import { chromium } from 'playwright';

const OUT = 'tooling/parity-harness/output/sidebar-docs-100-2026-06-01';
const label = process.argv[2] ?? 'after';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } } as never);
  await page.goto('http://localhost:4280/90152566819/home', { waitUntil: 'networkidle' });

  // Activate the Docs sidebar via the icon bar (button with aria-label="Docs"
  // inside the app-navigation rail; it calls setActiveIcon without navigating).
  await page.locator('a[data-test="global-sidebar-item-docs"]').click();
  await page.waitForSelector('text=RECENT');
  await page.waitForTimeout(300);

  await page.screenshot({ path: `${OUT}/${label}-full.png` });
  // Sidebar lives at x 64..320 in the oracle. Crop the same band.
  await page.screenshot({
    path: `${OUT}/${label}-sidebar.png`,
    clip: { x: 64, y: 0, width: 256, height: 900 },
  });

  await browser.close();
  console.log('saved', label);
})();
