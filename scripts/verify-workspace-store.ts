/**
 * Client-side smoke check for the workspace store hooks. Loads /home and
 * /my-work in a real browser, captures console + pageerror, and fails if any
 * error mentions the useSyncExternalStore loop signatures. Screenshots both.
 *
 * Run: npx playwright-core ... — see invocation in the verifying bash step.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4280/90152566819';
const ROUTES = ['/home', '/my-work'];
const FATAL = [
  'getServerSnapshot',
  'should be cached',
  'Maximum update depth',
  'infinite',
];
const OUT = '/tmp/parity-store-verify';

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let failed = false;

  for (const route of ROUTES) {
    const page = await browser.newPage();
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    const url = `${BASE}${route}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const name = route.replace(/\//g, '_') || '_root';
    await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });

    const fatal = errors.filter((e) =>
      FATAL.some((sig) => e.toLowerCase().includes(sig.toLowerCase())),
    );

    console.log(`\n=== ${route} ===`);
    console.log(`total console errors: ${errors.length}`);
    console.log(`fatal (loop) errors: ${fatal.length}`);
    if (errors.length) {
      console.log('--- all errors ---');
      for (const e of errors) console.log(`  • ${e.slice(0, 200)}`);
    }
    if (fatal.length) {
      failed = true;
      console.log('!!! FATAL store-loop errors present');
    } else {
      console.log('OK: no store-loop errors');
    }
    console.log(`screenshot: ${OUT}${name}.png`);

    await page.close();
  }

  await browser.close();
  if (failed) {
    console.log('\nRESULT: FAIL');
    process.exit(1);
  }
  console.log('\nRESULT: PASS — both routes clean');
}

main().catch((err) => {
  console.error('verify script crashed:', err);
  process.exit(2);
});
