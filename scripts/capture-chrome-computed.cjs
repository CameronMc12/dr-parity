#!/usr/bin/env node
/**
 * Capture COMPUTED styles for ClickUp's chrome regions from the live page and
 * bake them onto the exact DOM tree.
 *
 * The chrome (topbar / icon-rail / views-bar / toolbar) is rendered by Angular
 * web components whose styling is component-encapsulated (inline / JS-driven),
 * so it is NOT in the captured global stylesheet. De-scoped global CSS cannot
 * style it. The reliable fix: read getComputedStyle for every element in each
 * chrome subtree from the live page and serialise it, so the React clone can
 * re-apply those exact styles inline and render pixel-identical regardless of
 * the incomplete global CSS.
 *
 * Output: docs/research/clickup-parity/baseline/chrome-computed.json
 *
 * Usage:
 *   node scripts/capture-chrome-computed.cjs
 *   node scripts/capture-chrome-computed.cjs --url=<listUrl>
 */
const { mkdirSync, writeFileSync } = require('node:fs');
const { homedir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright');

const DEFAULT_URL = 'https://app.clickup.com/90152566819/v/l/li/901523751540';
const OUT_DIR = join('docs', 'research', 'clickup-parity', 'baseline');
const OUT_FILE = join(OUT_DIR, 'chrome-computed.json');
const VIEWPORT = { width: 1440, height: 900 };
const USER_DATA_DIR = join(homedir(), '.config', 'playwright-pinterest');

/**
 * The chrome roots to serialise, by stable CSS selector. Order is the visual
 * stacking we care about. The List view content/grid is intentionally excluded.
 */
const CHROME_ROOTS = [
  { key: 'topbar', selector: 'cu-global-actions-bar' },
  { key: 'iconRail', selector: 'cu-simple-bar' },
  { key: 'viewsBar', selector: 'cu2-views-bar' },
];

function parseUrl(argv) {
  for (const raw of argv) {
    if (raw.startsWith('--url=')) return raw.slice('--url='.length);
  }
  return DEFAULT_URL;
}

/**
 * Browser-side serialiser. Walks an element subtree and returns a tree of
 * { tag, attrs, text, computed, rect } where computed is the subset of
 * getComputedStyle that affects visual layout/paint. Empty text nodes are
 * dropped; leaf text is captured on the owning element.
 */
const SERIALISE_FN = `(rootSelector) => {
  const PROPS = [
    'display','position','top','left','right','bottom','float','clear',
    'width','height','minWidth','minHeight','maxWidth','maxHeight','boxSizing',
    'marginTop','marginRight','marginBottom','marginLeft',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'flex','flexGrow','flexShrink','flexBasis','flexDirection','flexWrap',
    'alignItems','alignSelf','alignContent','justifyContent','justifyItems',
    'order','gap','rowGap','columnGap',
    'gridTemplateColumns','gridTemplateRows','gridAutoFlow','gridColumn','gridRow',
    'fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing',
    'textAlign','textTransform','textDecoration','textOverflow','whiteSpace',
    'color','backgroundColor','backgroundImage','backgroundSize',
    'backgroundPosition','backgroundRepeat','backgroundClip',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle',
    'borderTopColor','borderRightColor','borderBottomColor','borderLeftColor',
    'borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius',
    'boxShadow','outline','transform','transformOrigin','opacity','visibility',
    'zIndex','overflow','overflowX','overflowY','cursor','pointerEvents',
    'fill','stroke','objectFit','verticalAlign','flexFlow'
  ];
  // Default computed values we can drop to keep the JSON small. These are the
  // browser defaults that, if applied inline, would have no visual effect.
  const DEFAULTS = {
    position: 'static', float: 'none', clear: 'none', boxSizing: 'content-box',
    marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px',
    paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
    flexGrow: '0', flexShrink: '1', order: '0', gap: 'normal', rowGap: 'normal',
    columnGap: 'normal', fontStyle: 'normal', textTransform: 'none',
    textDecoration: 'none solid rgb(0, 0, 0)', whiteSpace: 'normal',
    letterSpacing: 'normal', backgroundImage: 'none', backgroundRepeat: 'repeat',
    borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px',
    borderLeftWidth: '0px', borderTopStyle: 'none', borderRightStyle: 'none',
    borderBottomStyle: 'none', borderLeftStyle: 'none',
    borderTopLeftRadius: '0px', borderTopRightRadius: '0px',
    borderBottomLeftRadius: '0px', borderBottomRightRadius: '0px',
    boxShadow: 'none', outline: 'rgb(0, 0, 0) none 0px', transform: 'none',
    opacity: '1', visibility: 'visible', zIndex: 'auto', overflow: 'visible',
    overflowX: 'visible', overflowY: 'visible', pointerEvents: 'auto',
    objectFit: 'fill', verticalAlign: 'baseline', top: 'auto', left: 'auto',
    right: 'auto', bottom: 'auto', minWidth: 'auto', minHeight: 'auto',
    maxWidth: 'none', maxHeight: 'none', textOverflow: 'clip',
    backgroundPosition: '0% 0%', backgroundSize: 'auto', backgroundClip: 'border-box'
  };

  function pickComputed(el) {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of PROPS) {
      const v = cs[p];
      if (v === '' || v == null) continue;
      if (DEFAULTS[p] !== undefined && v === DEFAULTS[p]) continue;
      out[p] = v;
    }
    return out;
  }

  function attrsOf(el) {
    const a = {};
    for (const at of el.attributes) {
      // style is reconstructed from computed; skip live inline style attr.
      if (at.name === 'style') continue;
      a[at.name] = at.value;
    }
    return a;
  }

  function directText(el) {
    let t = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += n.nodeValue;
    }
    return t.replace(/\\s+/g, ' ').trim();
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }

  function walk(el, depth) {
    if (depth > 40) return null;
    const cs = getComputedStyle(el);
    // Drop fully-hidden subtrees (display:none) — they are not painted and only
    // bloat the snapshot. cu-hidden helpers stay if merely visibility:hidden so
    // layout slots are preserved.
    if (cs.display === 'none') return null;
    const node = {
      tag: el.tagName.toLowerCase(),
      attrs: attrsOf(el),
      computed: pickComputed(el),
      rect: rectOf(el),
    };
    const txt = directText(el);
    if (txt) node.text = txt;
    // <use> href for SVG icon rendering
    if (node.tag === 'use') {
      const href = el.getAttribute('xlink:href') || el.getAttribute('href');
      if (href) node.useHref = href;
    }
    const kids = [];
    for (const c of el.children) {
      const cn = walk(c, depth + 1);
      if (cn) kids.push(cn);
    }
    if (kids.length) node.children = kids;
    return node;
  }

  const root = document.querySelector(rootSelector);
  if (!root) return null;
  return { rect: (() => { const r = root.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(), tree: walk(root, 0) };
}`;

async function main() {
  const url = parseUrl(process.argv.slice(2));
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[chrome-computed] url     : ${url}`);
  console.log(`[chrome-computed] profile : ${USER_DATA_DIR}`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: VIEWPORT,
    serviceWorkers: 'block',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch {
      /* noop */
    }
  });

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(4_000);

    // Reset transient panels + ensure List tab active (mirrors capture-baseline).
    await sanityReset(page);
    await page.waitForTimeout(1_500);
    await selectListView(page);
    await page.waitForTimeout(2_000);

    const result = { capturedAt: new Date().toISOString(), viewport: VIEWPORT, regions: {} };
    for (const { key, selector } of CHROME_ROOTS) {
      console.log(`[chrome-computed] serialising ${key} (${selector})…`);
      const data = await page.evaluate(
        ({ fn, sel }) => new Function('return (' + fn + ')')()(sel),
        { fn: SERIALISE_FN, sel: selector },
      );
      if (!data) {
        console.warn(`[chrome-computed]   MISSING: ${selector}`);
        continue;
      }
      result.regions[key] = { selector, ...data };
      console.log(`[chrome-computed]   rect=${JSON.stringify(data.rect)} nodes=${countNodes(data.tree)}`);
    }

    writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf8');
    console.log(`[chrome-computed] wrote ${OUT_FILE}`);
  } finally {
    await context.close().catch(() => {});
  }
}

function countNodes(node) {
  if (!node) return 0;
  let n = 1;
  for (const c of node.children ?? []) n += countNodes(c);
  return n;
}

/** Inline port of sanityReset's intent: close panels via Escape + click List. */
async function sanityReset(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape').catch(() => {});
}

async function selectListView(page) {
  const listTab = page.locator('[data-test="data-view-item__List"]').first();
  if (await listTab.count().catch(() => 0)) {
    await listTab.click({ timeout: 5_000 }).catch(() => {});
  }
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(400);
    const ok = await page
      .evaluate(() => {
        const tabs = document.querySelectorAll('.cu-data-view-item');
        for (const t of tabs) {
          if (t.className.includes('cu-data-view-item_selected')) {
            const n = t.querySelector('.cu-data-view-item__name-text');
            if (n && (n.textContent || '').trim() === 'List') return true;
          }
        }
        return false;
      })
      .catch(() => false);
    if (ok) return;
  }
}

main().catch((err) => {
  console.error('[chrome-computed] fatal:', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
