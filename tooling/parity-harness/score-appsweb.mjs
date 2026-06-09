// Objective parity scorer for apps/web ClickUp clone vs replay oracle.
// Uses SEPARATE browser instances per target so the replay oracle service
// worker cannot leak into the apps/web page (the bundled harness shared a
// browser and the SW hijacked :5173 with a stale AAPL terminal page).
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import * as fs from 'node:fs';
import * as path from 'node:path';

const OUT = '/Users/cameronmcallister/Github/dr-parity/tooling/parity-harness/output/2026-06-05-appsweb-baseline';
fs.mkdirSync(OUT, { recursive: true });
const VP = { width: 1440, height: 900 };

const ROUTES = [
  { id: 'home', path: '/90152566819/home', settle: 4000 },
  { id: 'list', path: '/90152566819/v/l/2kyr6013-1115', settle: 5000 },
];

async function shoot(base, route) {
  // Fresh browser instance — no cross-target SW / storage contamination.
  const b = await chromium.launch({ headless: true });
  try {
    const ctx = await b.newContext({ viewport: VP, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto(base + route.path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(route.settle);
    const png = await p.screenshot({ fullPage: false });
    const html = await p.evaluate(() => document.documentElement.outerHTML);
    return { png, html };
  } finally {
    await b.close();
  }
}

function padPng(src, w, h) {
  if (src.width === w && src.height === h) return src;
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  PNG.bitblt(src, out, 0, 0, src.width, src.height, 0, 0);
  return out;
}

function pixelScore(aBuf, bBuf, threshold) {
  const a = PNG.sync.read(aBuf);
  const b = PNG.sync.read(bBuf);
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const total = w * h;
  const pa = padPng(a, w, h);
  const pb = padPng(b, w, h);
  const diff = new PNG({ width: w, height: h });
  const diffPixels = pixelmatch(pa.data, pb.data, diff.data, w, h, { threshold });
  return { score: total === 0 ? 1 : 1 - diffPixels / total, diffPixels, total, diffPng: PNG.sync.write(diff) };
}

// --- DOM stats (mirrors harness extractDomStats) ---
function extractDomStats(html) {
  const nodesByTag = {};
  let totalNodes = 0;
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g)) {
    const tag = m[1].toLowerCase();
    nodesByTag[tag] = (nodesByTag[tag] ?? 0) + 1;
    totalNodes++;
  }
  const nodesByClass = {};
  for (const m of html.matchAll(/\bclass="([^"]*)"/g))
    for (const cls of m[1].split(/\s+/).filter(Boolean)) nodesByClass[cls] = (nodesByClass[cls] ?? 0) + 1;
  let depth = 0, maxDepth = 0;
  const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const m of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/?>/g)) {
    const full = m[0], tag = m[1].toLowerCase();
    if (VOID.has(tag) || full.endsWith('/>')) continue;
    if (full.startsWith('</')) depth = Math.max(0, depth - 1);
    else { depth++; if (depth > maxDepth) maxDepth = depth; }
  }
  return { totalNodes, nodesByTag, nodesByClass, treeDepth: maxDepth };
}
function jaccard(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let inter = 0, uni = 0;
  for (const k of keys) { const av = a[k] ?? 0, bv = b[k] ?? 0; inter += Math.min(av, bv); uni += Math.max(av, bv); }
  return uni === 0 ? 1 : inter / uni;
}
function domScores(a, b) {
  const node = Math.max(a.totalNodes, b.totalNodes) === 0 ? 1 : 1 - Math.abs(a.totalNodes - b.totalNodes) / Math.max(a.totalNodes, b.totalNodes);
  const tag = jaccard(a.nodesByTag, b.nodesByTag);
  const cls = jaccard(a.nodesByClass, b.nodesByClass);
  const depth = Math.max(a.treeDepth, b.treeDepth) === 0 ? 1 : 1 - Math.abs(a.treeDepth - b.treeDepth) / Math.max(a.treeDepth, b.treeDepth);
  // harness blended metric (includes class names — penalises different naming)
  const harnessDom = (node + tag + cls + depth) / 4;
  // class-agnostic structural metric (fairer: tags + node count + depth only)
  const structural = (node + tag + depth) / 3;
  return { node, tag, cls, depth, harnessDom, structural };
}

const results = [];
for (const route of ROUTES) {
  console.log(`[score] ${route.id} ...`);
  const oracle = await shoot('http://127.0.0.1:7050', route);
  const apps = await shoot('http://127.0.0.1:5173', route);
  fs.writeFileSync(path.join(OUT, `${route.id}-oracle.png`), oracle.png);
  fs.writeFileSync(path.join(OUT, `${route.id}-appsweb.png`), apps.png);
  const px = pixelScore(oracle.png, apps.png, 0.1);
  fs.writeFileSync(path.join(OUT, `${route.id}-diff.png`), px.diffPng);
  const dom = domScores(extractDomStats(oracle.html), extractDomStats(apps.html));
  const r = {
    route: route.id,
    pixel_match: +px.score.toFixed(4),
    pixel_diff_pixels: px.diffPixels,
    pixel_total: px.total,
    dom_harness: +dom.harnessDom.toFixed(4),
    dom_structural_classagnostic: +dom.structural.toFixed(4),
    dom_tag_jaccard: +dom.tag.toFixed(4),
    dom_class_jaccard: +dom.cls.toFixed(4),
    dom_nodecount_sim: +dom.node.toFixed(4),
    dom_depth_sim: +dom.depth.toFixed(4),
    oracle_nodes: extractDomStats(oracle.html).totalNodes,
    appsweb_nodes: extractDomStats(apps.html).totalNodes,
  };
  results.push(r);
  console.log(`  pixel=${(r.pixel_match*100).toFixed(1)}%  domHarness=${(r.dom_harness*100).toFixed(1)}%  domStructural=${(r.dom_structural_classagnostic*100).toFixed(1)}%`);
}
const report = {
  generatedAt: new Date().toISOString(),
  oracle: 'http://127.0.0.1:7050 (replay-merged real ClickUp bundle, LIGHT theme)',
  candidate: 'http://127.0.0.1:5173 (apps/web Dr Parity ClickUp clone, DARK theme)',
  viewport: VP,
  note: 'apps/web is hardcoded DARK theme; oracle renders ClickUp default LIGHT theme. Full-page pixel% therefore measures layout AND theme delta combined.',
  results,
};
fs.writeFileSync(path.join(OUT, 'scores.json'), JSON.stringify(report, null, 2));
console.log('\nWROTE', path.join(OUT, 'scores.json'));
