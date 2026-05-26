#!/usr/bin/env tsx
/** Diagnose why the /v/li view route renders "page unavailable": log every API
 * call's path + x-replay-source + status so we can see which resolution call
 * returns empty-200 (the bundle treats {} as "no access"). */
import { chromium } from 'playwright';

const BASE = process.env.REPLAY_BASE ?? 'http://localhost:8910';
const PATH = process.env.PROBE_PATH ?? '/90152566819/v/li/901523543274';

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const calls: { method: string; url: string; status: number; src: string }[] = [];
  page.on('response', async (res) => {
    const u = new URL(res.url());
    if (/\.(js|css|woff2?|png|jpe?g|svg|gif|webp|ico|wasm|mp4)$/i.test(u.pathname)) return;
    if (u.origin === new URL(BASE).origin && !/\/(api|v1|v2|v3)\//.test(u.pathname)) return;
    calls.push({
      method: res.request().method(),
      url: u.host + u.pathname + (u.search ? '?' + u.search.slice(0, 40) : ''),
      status: res.status(),
      src: res.headers()['x-replay-source'] || res.headers()['x-backend'] || '-',
    });
  });

  await page.goto(`${BASE}${PATH}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 20000 }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(12000);

  const empties = calls.filter((c) => c.src === 'empty');
  const byHost = new Map<string, number>();
  for (const c of empties) {
    const k = c.method + ' ' + c.url.split('?')[0];
    byHost.set(k, (byHost.get(k) ?? 0) + 1);
  }
  console.log('=== empty-200 served (bundle sees {} ) ===');
  for (const [k, n] of [...byHost.entries()].sort((a, b) => b[1] - a[1])) console.log(n, k);
  console.log('\n=== view/resolve-ish calls ===');
  for (const c of calls) {
    if (/view|subcategory|viz|hierarchy|permission|sharing|share|access|guest|t\/v1|task-v3/i.test(c.url)) {
      console.log(c.status, c.src.padEnd(10), c.method, c.url);
    }
  }
  await browser.close();
}
main();
