import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:4280';
const OUT = join(process.cwd(), 'tooling/parity-harness/output/sidebars-global-2026-06-01');
const SECTIONS = ['ai', 'teams', 'dashboards', 'whiteboards'] as const;

async function main() {
  mkdirSync(OUT, true ? { recursive: true } : undefined);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });

  for (const id of SECTIONS) {
    const trigger = page.locator(`[data-test="global-sidebar-item-${id}"]`);
    await trigger.click();
    await page.waitForTimeout(400);
    const sidebar = page.locator('.cu-global-sidebar__container').first();
    await sidebar.screenshot({ path: join(OUT, `${id}-after.png`) });
    console.log(`captured ${id}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
