import pkg from '/Users/cameronmcallister/Github/dr-parity/node_modules/playwright/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'node:fs';

const OUT = '/Users/cameronmcallister/Github/dr-parity/tooling/parity-harness/output/routing-toolbar-fix-2026-06-01';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4280/90152566819';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const results = {};

// Route render checks
const routeChecks = [
  ['/home', 'home'],
  ['/my-work', 'mywork'],
  ['/inbox', 'inbox'],
  ['/chat/r/ch-demo', 'channel'],
];
for (const [path, key] of routeChecks) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const txt = (await page.locator('main, [role="main"]').first().innerText().catch(() => '')).replace(/\n+/g, ' | ');
  results['route ' + path] = txt.slice(0, 120);
  await page.screenshot({ path: `${OUT}/route-${key}.png` });
}

// Go to a list view to check toolbar + group header
await page.goto(BASE + '/my-work', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

// Issue 2: Customize present, no sun
const customizeVisible = await page.getByRole('button', { name: 'Customize' }).first().isVisible().catch(() => false);
const customizeText = await page.getByRole('button', { name: 'Customize' }).first().innerText().catch(() => '');
results['customize button visible'] = customizeVisible;
results['customize button text'] = customizeText.trim();
results['sun/theme toggle present'] = await page.getByRole('button', { name: /theme|dark mode|light mode|toggle theme/i }).count();

// Issue 3: group header ... and + (hover to reveal)
const groupHeader = page.locator('[data-testid="list-status-group"]').first();
await groupHeader.locator('div').first().hover().catch(() => {});
await page.waitForTimeout(200);
results['group menu (...) exists'] = await page.locator('[data-testid="list-group-menu"]').first().count();
results['group add (+) exists'] = await page.locator('[data-testid="list-group-add"]').first().count();
const ghMenuVisible = await page.locator('[data-testid="list-group-menu"]').first().isVisible().catch(() => false);
const ghAddVisible = await page.locator('[data-testid="list-group-add"]').first().isVisible().catch(() => false);
results['group menu visible on hover'] = ghMenuVisible;
results['group add visible on hover'] = ghAddVisible;
await page.screenshot({ path: `${OUT}/listview-toolbar-grouphdr.png` });

// Issue 4: topbar Create task opens modal
const beforeModal = await page.locator('[role="dialog"], [data-testid="create-task-modal"]').count();
await page.getByRole('button', { name: 'Create task' }).click();
await page.waitForTimeout(500);
const dialogCount = await page.locator('[role="dialog"]').count();
const modalText = await page.locator('[role="dialog"]').first().innerText().catch(() => '');
results['create-task modal before click'] = beforeModal;
results['create-task dialog after click'] = dialogCount;
results['modal text sample'] = modalText.slice(0, 80).replace(/\n+/g, ' | ');
await page.screenshot({ path: `${OUT}/topbar-create-task-modal.png` });

results['console errors'] = errors.slice(0, 8);

console.log(JSON.stringify(results, null, 2));
await browser.close();
