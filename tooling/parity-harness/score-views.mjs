// Per-view visual + DOM parity scorer: apps/web (candidate) vs real ClickUp
// light-theme oracle screenshots (DR-PARITY-SEED data, 1440x900).
//
// Measurement only. Does NOT modify apps/web or engine source. The dark->light
// theme switch is forced at RUNTIME in the browser before screenshotting.
//
// Metrics per view:
//   pixel%   full-frame pixelmatch similarity after light-theme forcing
//   DOM%     class-agnostic structural similarity (tag jaccard + nodecount + depth)
//   edge%    Sobel edge-map IoU (theme-independent backstop)
//
// Oracles are pre-captured PNGs on disk; the candidate is rendered live from
// http://127.0.0.1:5173 (apps/web Next.js dev server).

import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = '/Users/cameronmcallister/Github/dr-parity';
const ORACLE_DIR = path.join(ROOT, 'docs/research/crawl/app.clickup.com');
const OUT = path.join(ROOT, 'tooling/parity-harness/output/2026-06-05-views');
const APPS = 'http://127.0.0.1:5173';
const VP = { width: 1440, height: 900 };
const SEED_LIST = '901523751540';
const DOC_ID = '2kyr6013-715';

const VIEWS = [
  { id: 'home',     path: '/90152566819/home',                  settle: 5000 },
  { id: 'list',     path: `/90152566819/v/l/${SEED_LIST}`,      settle: 6000 },
  { id: 'board',    path: `/90152566819/v/b/${SEED_LIST}`,      settle: 6000 },
  { id: 'calendar', path: `/90152566819/v/cal/${SEED_LIST}`,    settle: 6000 },
  { id: 'gantt',    path: `/90152566819/v/gtt/${SEED_LIST}`,    settle: 6000 },
  { id: 'timeline', path: `/90152566819/v/tl/${SEED_LIST}`,     settle: 6000 },
  { id: 'table',    path: `/90152566819/v/tbl/${SEED_LIST}`,    settle: 6000 },
  { id: 'doc',      path: `/90152566819/v/dc/${DOC_ID}`,        settle: 6000 },
];

function oraclePath(id) {
  return path.join(ORACLE_DIR, `seed-view-${id}`, 'states/state-0001/screenshot.png');
}
function oracleDomPath(id) {
  return path.join(ORACLE_DIR, `seed-view-${id}`, 'states/state-0001/dom.html');
}

// ---------- light theme forcing (runtime only) ----------
const FORCE_LIGHT = () => {
  try {
    const keys = ['theme', 'cu-theme', 'color-theme', 'colorScheme', 'app-theme'];
    for (const k of keys) {
      try { localStorage.setItem(k, 'light'); } catch {}
    }
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
    if (document.body) {
      document.body.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
    }
  } catch {}
};

// sample average luminance of the top-left header strip + a mid background band
function isLight(png) {
  const { width, height, data } = png;
  let sum = 0, n = 0;
  // sample a grid across the full frame, skipping pure-transparent padding
  for (let y = 0; y < height; y += 20) {
    for (let x = 0; x < width; x += 20) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n++;
    }
  }
  return n ? sum / n : 0;
}

async function shoot(view) {
  const b = await chromium.launch({ headless: true });
  try {
    const ctx = await b.newContext({ viewport: VP, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    // inject light-forcing on every document (covers client nav + reloads)
    await ctx.addInitScript(FORCE_LIGHT);
    await p.goto(APPS + view.path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    // re-apply after hydration, then a second time post-settle
    await p.evaluate(FORCE_LIGHT).catch(() => {});
    await p.waitForTimeout(view.settle);
    await p.evaluate(FORCE_LIGHT).catch(() => {});
    await p.waitForTimeout(800);
    const png = await p.screenshot({ fullPage: false });
    const html = await p.evaluate(() => document.documentElement.outerHTML);
    const url = p.url();
    return { png, html, url };
  } finally {
    await b.close();
  }
}

// ---------- pixel ----------
function padPng(src, w, h) {
  if (src.width === w && src.height === h) return src;
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  PNG.bitblt(src, out, 0, 0, Math.min(src.width, w), Math.min(src.height, h), 0, 0);
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

// ---------- edge IoU (theme independent) ----------
function edges(png) {
  const { width: W, height: H, data } = png;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  const out = new PNG({ width: W, height: H });
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const gx = lum[(y - 1) * W + x + 1] + 2 * lum[y * W + x + 1] + lum[(y + 1) * W + x + 1]
             - lum[(y - 1) * W + x - 1] - 2 * lum[y * W + x - 1] - lum[(y + 1) * W + x - 1];
    const gy = lum[(y + 1) * W + x - 1] + 2 * lum[(y + 1) * W + x] + lum[(y + 1) * W + x + 1]
             - lum[(y - 1) * W + x - 1] - 2 * lum[(y - 1) * W + x] - lum[(y - 1) * W + x + 1];
    const mag = Math.sqrt(gx * gx + gy * gy);
    const v = mag > 60 ? 255 : 0;
    const i = (y * W + x) * 4;
    out.data[i] = v; out.data[i + 1] = v; out.data[i + 2] = v; out.data[i + 3] = 255;
  }
  return out;
}
function edgeIoU(aBuf, bBuf) {
  let a = PNG.sync.read(aBuf), b = PNG.sync.read(bBuf);
  const W = Math.max(a.width, b.width), H = Math.max(a.height, b.height);
  a = padPng(a, W, H); b = padPng(b, W, H);
  const ea = edges(a), eb = edges(b);
  let inter = 0, uni = 0;
  for (let i = 0; i < ea.data.length; i += 4) {
    const x = ea.data[i] > 0, y = eb.data[i] > 0;
    if (x && y) inter++; if (x || y) uni++;
  }
  return { score: uni ? inter / uni : 1, oraclePng: PNG.sync.write(ea), candPng: PNG.sync.write(eb) };
}

// ---------- DOM (class-agnostic) ----------
function extractDomStats(html) {
  const nodesByTag = {};
  let totalNodes = 0;
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g)) {
    const tag = m[1].toLowerCase();
    nodesByTag[tag] = (nodesByTag[tag] ?? 0) + 1;
    totalNodes++;
  }
  let depth = 0, maxDepth = 0;
  const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const m of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/?>/g)) {
    const full = m[0], tag = m[1].toLowerCase();
    if (VOID.has(tag) || full.endsWith('/>')) continue;
    if (full.startsWith('</')) depth = Math.max(0, depth - 1);
    else { depth++; if (depth > maxDepth) maxDepth = depth; }
  }
  return { totalNodes, nodesByTag, treeDepth: maxDepth };
}
function jaccard(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let inter = 0, uni = 0;
  for (const k of keys) { const av = a[k] ?? 0, bv = b[k] ?? 0; inter += Math.min(av, bv); uni += Math.max(av, bv); }
  return uni === 0 ? 1 : inter / uni;
}
function domStructural(a, b) {
  const node = Math.max(a.totalNodes, b.totalNodes) === 0 ? 1 : 1 - Math.abs(a.totalNodes - b.totalNodes) / Math.max(a.totalNodes, b.totalNodes);
  const tag = jaccard(a.nodesByTag, b.nodesByTag);
  const depth = Math.max(a.treeDepth, b.treeDepth) === 0 ? 1 : 1 - Math.abs(a.treeDepth - b.treeDepth) / Math.max(a.treeDepth, b.treeDepth);
  return { node, tag, depth, structural: (node + tag + depth) / 3 };
}

// ---------- run ----------
const results = [];
let lightOk = false;

for (const view of VIEWS) {
  const vOut = path.join(OUT, view.id);
  fs.mkdirSync(vOut, { recursive: true });
  const orcFile = oraclePath(view.id);
  if (!fs.existsSync(orcFile)) {
    console.log(`[${view.id}] MISSING oracle ${orcFile}`);
    results.push({ view: view.id, rendered: 'missing-oracle' });
    continue;
  }
  const oracleBuf = fs.readFileSync(orcFile);

  console.log(`[${view.id}] shooting ${view.path} ...`);
  let cand;
  try { cand = await shoot(view); }
  catch (e) { console.log(`  ERROR ${e.message}`); results.push({ view: view.id, rendered: 'error', error: e.message }); continue; }

  const candPng = PNG.sync.read(cand.png);
  const lum = isLight(candPng);
  const renderedLight = lum > 150;
  if (renderedLight) lightOk = true;

  fs.copyFileSync(orcFile, path.join(vOut, 'oracle.png'));
  fs.writeFileSync(path.join(vOut, 'appsweb.png'), cand.png);

  const px = pixelScore(oracleBuf, cand.png, 0.1);
  fs.writeFileSync(path.join(vOut, 'diff.png'), px.diffPng);

  const edge = edgeIoU(oracleBuf, cand.png);
  fs.writeFileSync(path.join(vOut, 'oracle-edges.png'), edge.oraclePng);
  fs.writeFileSync(path.join(vOut, 'appsweb-edges.png'), edge.candPng);

  // Real class-agnostic DOM comparison against the oracle's captured dom.html.
  const candStats = extractDomStats(cand.html);
  const orcDomFile = oracleDomPath(view.id);
  let dom = { structural: null, tag: null, node: null, depth: null, note: 'no oracle dom.html' };
  let oracleNodes = null, oracleDepth = null;
  if (fs.existsSync(orcDomFile)) {
    const orcStats = extractDomStats(fs.readFileSync(orcDomFile, 'utf8'));
    oracleNodes = orcStats.totalNodes; oracleDepth = orcStats.treeDepth;
    dom = domStructural(orcStats, candStats);
  }

  const r = {
    view: view.id,
    rendered: 'full',
    final_url: cand.url,
    rendered_light: renderedLight,
    avg_luminance: +lum.toFixed(1),
    pixel_pct: +(px.score * 100).toFixed(2),
    pixel_diff_pixels: px.diffPixels,
    edge_iou_pct: +(edge.score * 100).toFixed(2),
    dom_structural_pct: dom.structural === null ? null : +(dom.structural * 100).toFixed(2),
    dom_tag_jaccard_pct: dom.tag === null ? null : +(dom.tag * 100).toFixed(2),
    dom_nodecount_sim_pct: dom.node === null ? null : +(dom.node * 100).toFixed(2),
    dom_depth_sim_pct: dom.depth === null ? null : +(dom.depth * 100).toFixed(2),
    oracle_nodes: oracleNodes,
    oracle_depth: oracleDepth,
    candidate_nodes: candStats.totalNodes,
    candidate_depth: candStats.treeDepth,
  };
  results.push(r);
  console.log(`  light=${renderedLight}(${lum.toFixed(0)}) pixel=${r.pixel_pct}% dom=${r.dom_structural_pct}% edge=${r.edge_iou_pct}% nodes=${r.candidate_nodes}/${oracleNodes}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  viewport: VP,
  candidate: `${APPS} (apps/web, dark-theme default, FORCED light at runtime)`,
  oracles: 'docs/research/crawl/app.clickup.com/seed-view-<view>/states/state-0001/screenshot.png (real ClickUp light theme, DR-PARITY-SEED)',
  seedList: SEED_LIST,
  lightForcingWorked: lightOk,
  metrics: {
    pixel_pct: 'full-frame pixelmatch similarity after light forcing',
    edge_iou_pct: 'Sobel edge-map IoU, theme-independent backstop',
    dom_structural_pct: 'class-agnostic structural similarity (tag jaccard + nodecount + depth) vs oracle state-0001/dom.html',
  },
  results,
};
fs.writeFileSync(path.join(OUT, 'SCORES.json'), JSON.stringify(report, null, 2));
console.log('\nWROTE', path.join(OUT, 'SCORES.json'));
