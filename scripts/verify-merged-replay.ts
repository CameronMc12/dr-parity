#!/usr/bin/env tsx
/**
 * Probe the merged replay: for each app section, navigate, wait for the SW to
 * control the page, reload, poll for #app-root content, settle + scroll, then
 * report a truthful render verdict (renders / partial / blank) + a content
 * signal + a screenshot. Playwright CLI only.
 */
import { chromium, type Page } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.env.REPLAY_BASE ?? 'http://localhost:8910';

const ROUTES: { section: string; path: string }[] = [
  { section: 'dashboard', path: '/90152566819/home' },
  { section: 'docs-hub', path: '/90152566819/docs' },
  { section: 'calendar', path: '/90152566819/v/c/2kyr6013-375' },
  { section: 'board', path: '/90152566819/v/b/2kyr6013-835' },
  { section: 'list', path: '/90152566819/v/li/901523543274' },
  { section: 'task-detail', path: '/t/86c9yhmww' },
];

async function waitForController(page: Page): Promise<boolean> {
  return page
    .waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
}

type Signal = {
  appRootChars: number;
  bodyChars: number;
  offlineBanner: boolean;
  headingTexts: string[];
  interactiveEls: number;
  hasSkeleton: boolean;
};

async function readSignal(page: Page): Promise<Signal> {
  return page.evaluate(() => {
    const root =
      document.querySelector('#app-root') ||
      document.querySelector('cu-app') ||
      document.body;
    const text = (root?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const bodyText = (document.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const offline = /Offline mode/i.test(bodyText);
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]'))
      .map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 1)
      .slice(0, 8);
    const interactive = document.querySelectorAll(
      'button,a[href],[role="button"],input,textarea,[contenteditable="true"]',
    ).length;
    const skeleton = !!document.querySelector(
      '[class*="skeleton" i],[class*="shimmer" i],[class*="placeholder-loading" i]',
    );
    return {
      appRootChars: text.length,
      bodyChars: bodyText.length,
      offlineBanner: offline,
      headingTexts: headings,
      interactiveEls: interactive,
      hasSkeleton: skeleton,
    };
  });
}

function verdict(s: Signal): 'renders' | 'partial' | 'blank' {
  if (s.appRootChars < 40 && s.interactiveEls < 3) return 'blank';
  if (s.appRootChars >= 400 && s.interactiveEls >= 8) return 'renders';
  return 'partial';
}

async function probeRoute(
  page: Page,
  section: string,
  path: string,
): Promise<Record<string, unknown>> {
  const url = `${BASE}${path}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  const controlled = await waitForController(page);
  // Reload so the now-active SW controls every request from the first byte.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await waitForController(page);

  // Poll for app-root content to appear.
  await page
    .waitForFunction(
      () => {
        const r =
          document.querySelector('#app-root') ||
          document.querySelector('cu-app') ||
          document.body;
        return (r?.textContent ?? '').trim().length > 80;
      },
      { timeout: 25000 },
    )
    .catch(() => {});

  // 12s settle + scroll to wake lazy content.
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.scrollBy(0, 1200)).catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(3000);

  const signal = await readSignal(page);
  const screenshot = `/tmp/page-${section}.png`;
  await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});

  return {
    section,
    path,
    controlled,
    verdict: verdict(signal),
    ...signal,
    screenshot,
  };
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', () => {});

  const results: Record<string, unknown>[] = [];
  for (const route of ROUTES) {
    try {
      results.push(await probeRoute(page, route.section, route.path));
    } catch (err) {
      results.push({ section: route.section, path: route.path, verdict: 'blank', error: String(err) });
    }
  }

  await browser.close();
  writeFileSync('/tmp/merged-replay-verdicts.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main();
