import pw from '../node_modules/playwright/index.js';

const { chromium } = pw;

const APP_URL = 'http://localhost:5174/90152566819/inbox?tab=primary';
const PROBE_URL =
  'https://frontdoor-prod-eu-west-1-3.clickup.com/approvals-service/workspace/90152566819/approvals-count';

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const mswLogs: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (/\[MSW\]|mockServiceWorker|Mocking enabled/i.test(text)) mswLogs.push(text);
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(2_500);
  // Reload so the service worker controls the page.
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(2_500);

  const result = await page.evaluate(async (url) => {
    try {
      const res = await fetch(url, { method: 'GET' });
      const bodyText = await res.text();
      return {
        ok: true,
        status: res.status,
        mswHeader: res.headers.get('x-powered-by'),
        bodyPreview: bodyText.slice(0, 200),
      };
    } catch (err) {
      return { ok: false, status: 0, error: String(err) };
    }
  }, PROBE_URL);

  console.log('PROBE_URL:', PROBE_URL);
  console.log('RESULT:', JSON.stringify(result, null, 2));
  console.log('MSW_CONSOLE_LOGS:', mswLogs.slice(0, 10).join('\n  '));

  await browser.close();
}

main().catch((err) => {
  console.error('PROBE_FAILED:', err);
  process.exit(1);
});
