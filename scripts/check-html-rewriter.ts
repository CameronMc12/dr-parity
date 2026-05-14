/**
 * Smoke test for engine/clone/html-rewriter.
 *
 * Verifies that non-void elements (script, iframe, textarea, style, noscript)
 * always serialise with explicit closing tags, and that HTML5 void elements
 * (br, img) are left untouched. Run via:
 *
 *   npm run check:html-rewriter
 */

import { rewriteHtml } from '../engine/clone/html-rewriter';
import type { UrlMap } from '../engine/clone/types';

type Case = {
  name: string;
  input: string;
  mustInclude?: string[];
  mustNotInclude?: string[];
};

const documentUrl = 'https://example.com/index.html';
const ownClonePath = 'index.html';
const urlMap: UrlMap = new Map();
const unresolved = new Set<string>();

const cases: Case[] = [
  {
    name: 'script with src round-trips with explicit close tag',
    input: '<html><head><script src="./scripts/foo.js" defer></script></head><body><p>hi</p></body></html>',
    // Note: cheerio normalises boolean `defer` to `defer=""`; that's valid HTML.
    // What matters is the explicit </script>, NOT a self-closing slash.
    mustInclude: ['src="./scripts/foo.js"', '></script>'],
    mustNotInclude: ['/></script>', 'defer/>', 'defer />', 'defer=""/>'],
  },
  {
    name: 'iframe round-trips with explicit close',
    input: '<html><body><iframe src="y.html"></iframe></body></html>',
    mustInclude: ['<iframe src="y.html"></iframe>'],
    mustNotInclude: ['<iframe src="y.html"/>'],
  },
  {
    name: 'textarea round-trips with explicit close',
    input: '<html><body><textarea name="t"></textarea></body></html>',
    mustInclude: ['<textarea name="t"></textarea>'],
    mustNotInclude: ['<textarea name="t"/>'],
  },
  {
    name: 'noscript round-trips with explicit close',
    input: '<html><body><noscript>js off</noscript></body></html>',
    mustInclude: ['<noscript>js off</noscript>'],
    mustNotInclude: ['<noscript/>'],
  },
  {
    name: 'br stays self-closed-ish (void)',
    input: '<html><body><p>line1<br>line2</p></body></html>',
    mustInclude: ['<br'],
    mustNotInclude: ['</br>'],
  },
  {
    name: 'img stays without closing tag (void)',
    input: '<html><body><img src="z.png" alt="z"></body></html>',
    mustInclude: ['<img'],
    mustNotInclude: ['</img>'],
  },
  {
    name: 'self-closing script in input is expanded to explicit close',
    input: '<html><head><script src="./scripts/bar.js" type="module"/></head><body><p>after</p></body></html>',
    mustInclude: ['></script>', '<p>after</p>'],
    mustNotInclude: ['<script src="./scripts/bar.js" type="module"/>'],
  },
];

let failures = 0;
for (const c of cases) {
  const out = rewriteHtml({
    html: c.input,
    documentUrl,
    ownClonePath,
    urlMap,
    unresolved,
  });
  const missing = (c.mustInclude ?? []).filter((s) => !out.includes(s));
  const bad = (c.mustNotInclude ?? []).filter((s) => out.includes(s));
  if (missing.length === 0 && bad.length === 0) {
    console.log(`OK   ${c.name}`);
    continue;
  }
  failures++;
  console.error(`FAIL ${c.name}`);
  if (missing.length > 0) console.error(`  missing: ${JSON.stringify(missing)}`);
  if (bad.length > 0) console.error(`  found-but-shouldnt: ${JSON.stringify(bad)}`);
  console.error(`  output: ${out}`);
}

if (failures > 0) {
  console.error(`\n${failures} case(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} cases passed`);
