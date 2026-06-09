import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(
  "tooling/parity-harness/output/final-sidebars-2026-06-01",
);
mkdirSync(OUT, { recursive: true });

const ICONS = [
  "home",
  "spaces",
  "chat",
  "planner",
  "ai",
  "teams",
  "docs",
  "dashboards",
  "whiteboards",
  "timesheets",
];

// sidebar region: x 64..320, full height (900)
const CLIP = { x: 64, y: 0, width: 320 - 64, height: 900 };

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  await page.goto("http://localhost:4280", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const results: Record<string, string> = {};

  for (const id of ICONS) {
    const sel = `[data-test="global-sidebar-item-${id}"]`;
    let note = "";
    try {
      const el = page.locator(sel).first();
      const count = await el.count();
      if (count === 0) {
        note = "ICON-NOT-FOUND";
      } else {
        await el.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        note = "clicked";
      }
    } catch (e: any) {
      note = `click-error: ${String(e?.message || e).slice(0, 80)}`;
    }

    const file = path.join(OUT, `web-${id}.png`);
    await page.screenshot({ path: file, clip: CLIP });
    results[id] = note;
    console.log(`${id.padEnd(12)} ${note} -> ${file}`);
  }

  // also a full-page shot for timesheets to confirm full-width/no-sidebar
  try {
    await page.locator(`[data-test="global-sidebar-item-timesheets"]`).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
  } catch {}
  await page.screenshot({ path: path.join(OUT, "web-timesheets-fullpage.png"), fullPage: false });
  console.log("timesheets full-page captured");

  await browser.close();
  console.log("DONE", JSON.stringify(results));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
