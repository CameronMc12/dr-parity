import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4000);
  const m = JSON.parse(
    readFileSync(
      '/Users/cameronmcallister/Github/omnichannel-clone/react-app/src/interactions/index/manifest.json',
      'utf8',
    ),
  ) as { triggers: { selector: string; kind: string; text: string }[] };
  const triggers = m.triggers.filter((t) => t.kind !== 'demo');
  console.log(`Testing ${triggers.length} captured triggers...`);
  let found = 0;
  let missing = 0;
  for (const t of triggers) {
    const exists = await page.$(t.selector).catch(() => null);
    if (exists) {
      found++;
      console.log(`  OK   [${t.kind}] ${(t.text || '(no text)').slice(0, 35)}`);
    } else {
      missing++;
      console.log(`  MISS [${t.kind}] ${(t.text || '(no text)').slice(0, 35)}`);
    }
  }
  console.log(`\nResolved ${found}/${triggers.length} captured triggers via their saved selectors`);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
