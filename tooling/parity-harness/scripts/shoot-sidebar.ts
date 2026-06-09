import { chromium } from 'playwright';

// shoot-sidebar.ts <url> <outPath>
const [url, out] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out });
  console.log(`shot ${out}`);
  await browser.close();
})();
