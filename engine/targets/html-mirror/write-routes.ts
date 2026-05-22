/**
 * Per-route HTML emission for the static mirror.
 *
 * Reads each captured route HTML, strips runtime/tracking script tags,
 * rewrites internal links and mirrored asset URLs, then writes to a
 * directory-index layout so `/posts` resolves to `posts/index.html` when
 * served as a static directory.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { stripRuntimeTags } from '../webapp/strip-runtime-tags';
import { rewriteHtml } from './rewrite-links';
import type { RouteEmitResult } from './types';

export interface RouteManifestEntry {
  path: string;
  url?: string;
  htmlPath: string;
  title?: string;
  capturedAt?: string;
}

function routeToOutputFile(outDir: string, routePath: string): string {
  // Normalise: leading "/" only, no trailing slash
  let p = routePath.trim();
  if (p === '' || p === '/') return join(outDir, 'index.html');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.endsWith('/')) p = p.slice(0, -1);
  // /posts -> <out>/posts/index.html
  return join(outDir, p.slice(1), 'index.html');
}

function countScripts(html: string): number {
  // crude but cheap; we only need a delta
  const m = html.match(/<script\b/gi);
  return m ? m.length : 0;
}

export function emitRoute(
  crawlDir: string,
  outDir: string,
  entry: RouteManifestEntry,
  originHost: string,
): RouteEmitResult {
  const src = join(crawlDir, entry.htmlPath);
  const raw = readFileSync(src, 'utf8');
  const beforeScripts = countScripts(raw);

  const stripped = stripRuntimeTags(raw);
  const afterScripts = countScripts(stripped);

  const { html, linksRewritten, assetsRewritten } = rewriteHtml(stripped, originHost);

  const outFile = routeToOutputFile(outDir, entry.path);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, 'utf8');

  return {
    path: entry.path,
    outFile,
    title: entry.title ?? '',
    scriptsStripped: Math.max(0, beforeScripts - afterScripts),
    linksRewritten,
    assetsRewritten,
  };
}
