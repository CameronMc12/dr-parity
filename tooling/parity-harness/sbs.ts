import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(
  "tooling/parity-harness/output/final-sidebars-2026-06-01",
);
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

function b64(p: string): string {
  return "data:image/png;base64," + readFileSync(p).toString("base64");
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const id of ICONS) {
    const web = b64(path.join(OUT, `web-${id}.png`));
    const oracle = b64(path.join(OUT, `oracle-${id}.png`));
    const html = `<!doctype html><html><body style="margin:0;background:#111;font-family:system-ui">
    <div style="display:flex;gap:12px;padding:12px;align-items:flex-start">
      <div><div style="color:#0f0;font:600 13px system-ui;padding:4px">apps/web (clone)</div><img src="${web}" style="display:block;border:1px solid #333"/></div>
      <div><div style="color:#0ff;font:600 13px system-ui;padding:4px">real ClickUp (oracle)</div><img src="${oracle}" style="display:block;border:1px solid #333"/></div>
    </div></body></html>`;
    await page.setContent(html);
    await page.waitForTimeout(150);
    const el = page.locator("body > div").first();
    await el.screenshot({ path: path.join(OUT, `sidebyside-${id}.png`) });
    console.log(`sidebyside-${id}.png`);
  }
  await browser.close();
  console.log("DONE");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
