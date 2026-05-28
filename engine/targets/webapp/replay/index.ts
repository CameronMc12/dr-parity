/**
 * Replay target entrypoint. Emits a self-contained static site that serves a
 * captured SPA's REAL bootstrap HTML + JS bundle offline and answers every
 * network call from the recorded traffic.
 *
 * Pipeline:
 *   1. Localize every captured asset (JS bundle, CSS, fonts, images, sprites)
 *      into `public/_ext/...` via emit-assets-from-crawl (reused). This yields
 *      the URL -> local-path asset map used for rewriting.
 *   2. Load the ORIGINAL bootstrap navigation HTML (pre-JS) from network.jsonl.
 *   3. Build runtime recordings (reuse emit-mocks grouping) + WS connections
 *      (reuse emit-realtime frame loading/grouping).
 *   4. Emit the boot shim (storage seed + WS replay + SW register) and the
 *      Service Worker (fetch interception). Rewrite the bootstrap HTML to point
 *      at local assets and inject the boot shim first in <head>.
 *   5. Write the runnable dir + replay-manifest.json.
 *
 * Output layout (served by `npx serve <outDir>`):
 *   <outDir>/
 *     index.html                 # rewritten bootstrap + injected boot shim
 *     sw.js                      # service worker (fetch interceptor) — at ROOT
 *                                # so its default scope is '/' and it controls
 *                                # the whole origin (page + bundle + assets).
 *     replay/recordings.json     # runtime recordings the SW matches against
 *     replay-manifest.json
 *     _ext/<host>/...            # localized JS/CSS/font/image/sprite assets
 */

import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { emitAssetsFromCrawl, mergeCrawlIntoCloneMap } from '../emit-assets-from-crawl';
import { loadWsFrames, groupByConnection } from '../emit-realtime';
import { loadBootstrapDocument, loadSeededState } from './load-bootstrap-html';
import { buildRecordings } from './build-recordings';
import { mergeRecordings, mergeAssets } from './merge-crawls';
import { backfillFromCdn } from './cdn-backfill';
import { rewriteBootstrapHtml } from './rewrite-bootstrap';
import { buildBootShim } from './emit-boot-shim';
import { buildServiceWorker } from './emit-sw';
import { generateBridgeRecordings } from './bridge';
import { resolveProfile } from '../profiles/index';
import { expandBootstrapCorpus } from '../crawler/discovery/api-hierarchy-traverser';
import { inferViewTemplates } from './synth/view-template-inference';
import { emitViewTemplates } from './synth/view-template-emitter';
import type {
  ReplayBuildOptions,
  ReplayBuildResult,
  ReplayManifest,
  ReplayWsConnection,
} from './types';

function prepareOutDir(outDir: string, force: boolean): void {
  if (existsSync(outDir)) {
    if (!statSync(outDir).isDirectory()) {
      throw new Error(`Output path exists and is not a directory: ${outDir}`);
    }
    if (!force) {
      throw new Error(`Output directory already exists: ${outDir}. Pass force to overwrite.`);
    }
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });
}

function writeFile(outDir: string, relPath: string, content: string): void {
  const abs = join(outDir, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

/**
 * Union WS connections across ALL crawl dirs (bootstrap FIRST). The bootstrap
 * keeps priority for shared channels it captured (the main `/ws` + the graphql
 * gateway), and later (e.g. doc) crawls ADD their per-resource channels the
 * bootstrap never opened — notably the per-doc `coeditor` collaboration socket
 * whose server frames flip the ProseMirror doc editor from its hidden buffer to
 * the painted body. Dedup is by connection URL: the first dir to contribute a
 * given URL wins, so this is purely additive (no shared channel is overwritten).
 */
async function loadWsConnections(
  crawlDirs: string[],
): Promise<{ connections: ReplayWsConnection[]; frameCount: number; warnings: string[] }> {
  const byUrl = new Map<string, ReplayWsConnection>();
  const warnings: string[] = [];
  let frameCount = 0;

  for (const crawlDir of crawlDirs) {
    const { frames, warnings: w } = await loadWsFrames(crawlDir);
    warnings.push(...w);
    if (frames.length === 0) continue;
    for (const g of groupByConnection(frames)) {
      if (byUrl.has(g.url)) continue; // first dir wins for a shared channel
      byUrl.set(g.url, {
        url: g.url,
        urlPattern: g.urlPattern,
        frames: g.frames.map((f) => ({
          direction: f.direction,
          atMs: f.relativeMs,
          payload: f.payload,
        })),
      });
      frameCount += g.frames.length;
    }
  }

  return { connections: [...byUrl.values()], frameCount, warnings };
}

export async function emitReplay(options: ReplayBuildOptions): Promise<ReplayBuildResult> {
  const { crawlDir, outDir, force } = options;
  const unrecordedMode = options.unrecordedMode ?? 'empty-200';
  const warnings: string[] = [];

  // The bootstrap crawl is always FIRST in the union so its assets win on a
  // content conflict and its recordings seed the dedup map. Extra merge dirs
  // (one per app section) fill in every other route's data + assets.
  const extraDirs = (options.mergeDirs ?? []).filter((d) => d !== crawlDir);
  const allCrawlDirs = [crawlDir, ...extraDirs];

  prepareOutDir(outDir, force);

  // 1. Localize every captured asset across ALL crawls into <outDir>/_ext/...
  // First-writer wins (identical content-hashed bundles), so the bootstrap crawl
  // keeps priority and later crawls only fill gaps. A single dir reduces to the
  // original single-crawl localize.
  const mergedAssets = await mergeAssets({ crawlDirs: allCrawlDirs, publicDir: outDir });
  warnings.push(...mergedAssets.warnings);
  const assetResult = mergedAssets.combined;

  // 2. Load the original bootstrap HTML.
  const bootstrap = await loadBootstrapDocument(crawlDir);
  if (!bootstrap) {
    throw new Error(
      'No bootstrap HTML found in network.jsonl (no text/html response). ' +
        'The crawl must contain the original navigation document.',
    );
  }
  const assetMap = mergeCrawlIntoCloneMap(null, assetResult, bootstrap.url);

  // 2b. Backfill first-party static assets the crawl missed (early render-
  // blocking requests like the global stylesheet, lazy /assets/* media). These
  // are PUBLIC on the ClickUp CDN; fetch them live and extend the asset map so
  // the bootstrap rewriter localizes them. Best-effort: failures warn, not throw.
  const backfill = await backfillFromCdn({
    html: bootstrap.html,
    documentUrl: bootstrap.url,
    outDir,
    assetMap,
  });
  warnings.push(...backfill.warnings);

  // 3. Build recordings (UNIONED across every crawl, deduped by request
  // fingerprint, richest body wins) + WS connections (UNIONED across every crawl,
  // bootstrap first, deduped by connection URL so per-doc coeditor channels add).
  const merged = await mergeRecordings(allCrawlDirs);
  const recordings = merged.recordings;
  warnings.push(...merged.warnings);
  const ws = await loadWsConnections(allCrawlDirs);
  warnings.push(...ws.warnings);

  // 3b. Additive: merge export-bridge recordings so the replay renders lists the
  // crawl never captured. Bridge recordings are APPENDED (captured recordings
  // keep priority for their own list); a sidecar index routes tasks/bulk by id.
  let bridgeRecordingCount = 0;
  let bridgeListCount = 0;
  let bridgeIndex: unknown = null;
  if (options.bridgeExportDir) {
    const bridge = await generateBridgeRecordings(crawlDir, options.bridgeExportDir);
    warnings.push(...bridge.warnings);
    recordings.push(...bridge.recordings);
    bridgeRecordingCount = bridge.recordings.length;
    bridgeListCount = bridge.listCount;
    bridgeIndex = bridge.index;
  }

  // 4. Emit boot shim + SW, rewrite bootstrap HTML.
  const seeded = loadSeededState(crawlDir);
  const bootShimJs = buildBootShim({ seeded, wsConnections: ws.connections });
  // 4a. Additive: view-synth template inference (ClickUp profile only).
  // Resolves the profile from the bootstrap host, checks viewSynth.enabled,
  // expands the templatePaths glob, infers one template per viewType, and
  // emits replay/view-templates.json. No-op for every other profile.
  let enableViewSynth = false;
  {
    let synthHost = '';
    try {
      synthHost = new URL(bootstrap.url).host;
    } catch {
      synthHost = '';
    }
    if (synthHost) {
      const profile = resolveProfile(synthHost);
      if (profile.viewSynth?.enabled) {
        const templateFiles = expandBootstrapCorpus(profile.viewSynth.templatePaths ?? []);
        if (templateFiles.length > 0) {
          const templates = await inferViewTemplates(templateFiles);
          if (templates.size > 0) {
            emitViewTemplates(templates, outDir);
            enableViewSynth = true;
            warnings.push(
              `[view-synth] inferred ${templates.size} view template(s) from ${templateFiles.length} log file(s)`,
            );
          }
        }
      }
    }
  }
  const serviceWorker = buildServiceWorker(unrecordedMode, options.backendUrl ?? '', enableViewSynth);

  const { html } = rewriteBootstrapHtml({
    html: bootstrap.html,
    documentUrl: bootstrap.url,
    assetMap,
    bootShimJs,
  });

  // 5. Write runnable dir.
  writeFile(outDir, 'index.html', html);
  writeFile(outDir, 'sw.js', serviceWorker);
  writeFile(outDir, 'replay/recordings.json', JSON.stringify(recordings));
  if (bridgeIndex) {
    writeFile(outDir, 'replay/bridge-index.json', JSON.stringify(bridgeIndex));
  }

  const idbDatabases = seeded?.indexedDB ?? [];
  const idbRecords = idbDatabases.reduce(
    (sum, db) => sum + db.stores.reduce((s, store) => s + store.records.length, 0),
    0,
  );

  const name = options.name ?? deriveName(bootstrap.url);
  const manifest: ReplayManifest = {
    name,
    bootstrapUrl: bootstrap.url,
    assetCount: assetResult.written,
    backfilledCount: backfill.backfilled,
    backfillFailedCount: backfill.failed,
    backfillCriticalFailures: backfill.criticalFailures,
    recordingCount: recordings.length,
    wsConnectionCount: ws.connections.length,
    wsFrameCount: ws.frameCount,
    storageSeeded: seeded !== null,
    idbSeeded: idbDatabases.length > 0,
    idbDatabases: idbDatabases.length,
    idbRecords,
    unrecordedMode,
    bridgeRecordingCount,
    bridgeListCount,
    mergedCrawlDirs: allCrawlDirs,
    recordingsBeforeDedup: merged.totalBeforeDedup,
    recordingBodyBytes: merged.bodyBytes,
    warnings,
  };
  writeFile(outDir, 'replay-manifest.json', JSON.stringify(manifest, null, 2));

  return {
    outDir,
    manifest,
    serveCommand: `npx serve "${outDir}"`,
  };
}

function deriveName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '-');
  } catch {
    return 'replay-site';
  }
}

export type {
  ReplayBuildOptions,
  ReplayBuildResult,
  ReplayManifest,
  ReplayRecording,
  ReplayWsConnection,
  SeededIdbDatabase,
  SeededIdbStore,
  SeededState,
  UnrecordedMode,
} from './types';
export { loadBootstrapDocument, loadSeededState } from './load-bootstrap-html';
export { buildRecordings } from './build-recordings';
export { backfillFromCdn } from './cdn-backfill';
export { rewriteBootstrapHtml } from './rewrite-bootstrap';
export { buildBootShim } from './emit-boot-shim';
export { buildServiceWorker } from './emit-sw';
