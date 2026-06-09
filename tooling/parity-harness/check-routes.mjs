import pkg from '/Users/cameronmcallister/Github/dr-parity/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = 'http://localhost:4280/90152566819';
const routes = [
  ['/home', 'home'],
  ['/my-work', 'my-work'],
  ['/inbox', 'inbox'],
  ['/chat/r/threads', 'threads'],
  ['/chat/r/assigned', 'assigned'],
  ['/chat/r/ch-demo', 'ch-demo'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

for (const [path] of routes) {
  errors.length = 0;
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const h1 = await page.locator('h1, h2, [role="heading"]').first().textContent().catch(() => null);
  const main = (await page.locator('main, [role="main"]').first().innerText().catch(() => '')).slice(0, 160).replace(/\n+/g, ' | ');
  console.log(`\n=== ${path} ===`);
  console.log('  heading:', JSON.stringify(h1));
  console.log('  main[0:160]:', JSON.stringify(main));
  if (errors.length) console.log('  CONSOLE ERRORS:', errors.slice(0, 3));
}

await browser.close();
