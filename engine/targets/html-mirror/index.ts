/**
 * Static HTML mirror builder.
 *
 * Produces a no-framework, no-JS snapshot of a crawled site so the
 * captured DOM can be evaluated as ground truth. Reuses the webapp
 * target's asset-extraction pipeline so CSS/fonts/images mirror exactly
 * what the crawler captured.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { emitAssets } from '../webapp/emit-assets';
import { emitRoute, type RouteManifestEntry } from './write-routes';
import type { BuildHtmlMirrorOptions, HtmlMirrorSummary } from './types';

export type { BuildHtmlMirrorOptions, HtmlMirrorSummary, RouteEmitResult } from './types';

function inferOriginHost(crawlDir: string): string {
  // crawl path: docs/research/crawl/<host>/<timestamp>/
  return basename(dirname(resolve(crawlDir)));
}

function loadRoutesManifest(crawlDir: string): RouteManifestEntry[] {
  const manifestPath = join(crawlDir, 'routes.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing routes manifest at ${manifestPath}`);
  }
  const raw = readFileSync(manifestPath, 'utf8');
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const routes = Array.isArray(parsed?.routes) ? parsed.routes : [];
  return routes.filter(
    (r: any) => r && typeof r.path === 'string' && typeof r.htmlPath === 'string',
  );
}

function moveDirContentsUp(fromDir: string, toDir: string): void {
  if (!existsSync(fromDir)) return;
  const entries = readdirSync(fromDir);
  for (const name of entries) {
    const src = join(fromDir, name);
    const dest = join(toDir, name);
    if (existsSync(dest)) {
      // merge by recursing into directories; overwrite files
      if (statSync(src).isDirectory() && statSync(dest).isDirectory()) {
        moveDirContentsUp(src, dest);
        // try removing the now-empty source dir
        try {
          rmSync(src, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
        continue;
      }
      rmSync(dest, { recursive: true, force: true });
    }
    renameSync(src, dest);
  }
  try {
    rmSync(fromDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function writeServeScript(outDir: string): void {
  const file = join(outDir, 'serve.sh');
  // NOTE: no -s/--single flag. We want directory-index resolution so that
  // /posts resolves to posts/index.html, not a SPA fallback to root.
  const body = `#!/usr/bin/env bash\ncd "$(dirname "$0")"\nexec npx --yes serve@14 -l 5174 .\n`;
  writeFileSync(file, body, 'utf8');
  try {
    chmodSync(file, 0o755);
  } catch {
    /* ignore */
  }
}

function writeReadme(
  outDir: string,
  summary: HtmlMirrorSummary,
  crawlDir: string,
  originHost: string,
): void {
  const lines: string[] = [];
  lines.push('# Static HTML Mirror');
  lines.push('');
  lines.push(`Source crawl: \`${crawlDir}\``);
  lines.push(`Origin host: \`${originHost}\``);
  lines.push('');
  lines.push('This is a no-framework, no-JS static mirror of the captured crawl.');
  lines.push('It exists so the raw captured DOM can be evaluated as ground truth.');
  lines.push('');
  lines.push('## Serve');
  lines.push('');
  lines.push('```bash');
  lines.push('./serve.sh');
  lines.push('# or:');
  lines.push('npx --yes serve@14 -l 5174 .   # NB: no -s flag; we want directory-index resolution');
  lines.push('# or with Python:');
  lines.push('python3 -m http.server 5174');
  lines.push('```');
  lines.push('');
  lines.push(`Open: http://localhost:5174/`);
  lines.push('');
  lines.push('## Routes Included');
  lines.push('');
  for (const r of summary.routes) {
    lines.push(`- \`${r.path}\` -> \`${r.outFile.replace(outDir + '/', '')}\``);
  }
  lines.push('');
  lines.push('## What Was Stripped');
  lines.push('');
  lines.push('The following are NOT functional in this mirror:');
  lines.push('');
  lines.push('- ES module entry scripts (`<script type="module">`)');
  lines.push('- Bundler asset scripts (`<script src="/assets/...">`)');
  lines.push('- Module preload hints (`<link rel="modulepreload">`)');
  lines.push('- Tracking SDKs: Meta Pixel, GA, GTM, Stripe.js, reCAPTCHA, Clarity, PostHog, Hotjar, Intercom, Amplitude, Segment, Cloudflare Insights');
  lines.push('- Inline tracking boot blocks (fbq, gtag, etc.)');
  lines.push('');
  lines.push('CSS `<link>` tags and inline `<style>` blocks are preserved so pages render styled.');
  lines.push('');
  lines.push('## Stats');
  lines.push('');
  lines.push(`- Routes emitted: ${summary.routesEmitted}`);
  lines.push(`- Assets copied: ${summary.assetsCopied} (${summary.assetsBytes} bytes)`);
  lines.push(`- Internal links rewritten: ${summary.internalLinksRewritten}`);
  lines.push(`- Scripts stripped: ${summary.scriptsStripped}`);
  if (summary.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    lines.push('');
    for (const w of summary.warnings) lines.push(`- ${w}`);
  }
  lines.push('');
  writeFileSync(join(outDir, 'README.md'), lines.join('\n'), 'utf8');
}

export async function buildHtmlMirror(
  options: BuildHtmlMirrorOptions,
): Promise<HtmlMirrorSummary> {
  const crawlDir = resolve(options.crawlDir);
  const outDir = resolve(options.outDir);
  const originHost = options.originHost ?? inferOriginHost(crawlDir);

  if (!existsSync(crawlDir)) {
    throw new Error(`Crawl directory does not exist: ${crawlDir}`);
  }
  mkdirSync(outDir, { recursive: true });

  const routes = loadRoutesManifest(crawlDir);

  // 1) Mirror assets. emitAssets writes to <outDir>/public/<url-path>;
  //    move contents up so /assets/X is served at <outDir>/assets/X.
  const assetSummary = await emitAssets(crawlDir, outDir, {
    originHosts: originHost ? [originHost] : undefined,
  });
  moveDirContentsUp(join(outDir, 'public'), outDir);

  // 2) Emit per-route HTML.
  const routeResults = [];
  let totalScripts = 0;
  let totalLinks = 0;
  for (const entry of routes) {
    try {
      const result = emitRoute(crawlDir, outDir, entry, originHost);
      routeResults.push(result);
      totalScripts += result.scriptsStripped;
      totalLinks += result.linksRewritten;
    } catch (err) {
      assetSummary.warnings.push(
        `Failed to emit ${entry.path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const summary: HtmlMirrorSummary = {
    outDir,
    routesEmitted: routeResults.length,
    assetsCopied: assetSummary.copiedCount,
    assetsBytes: assetSummary.totalBytes,
    internalLinksRewritten: totalLinks,
    scriptsStripped: totalScripts,
    routes: routeResults,
    warnings: assetSummary.warnings,
  };

  // 3) README + serve script
  writeReadme(outDir, summary, crawlDir, originHost);
  writeServeScript(outDir);

  return summary;
}
