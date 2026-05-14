/**
 * Regex-based CSS url() and @import rewriter.
 *
 * Resolves every URL relative to the CSS file's original absolute URL
 * (or to whatever base the caller passes — e.g. document URL for
 * inline <style> contents). If the resolved URL is not in the map,
 * the original value is left intact so external CDNs keep working.
 */

import { resolveUrl, relativeFromClonePath } from './url-map';
import type { UrlMap } from './types';

type RewriteArgs = {
  css: string;
  /** Absolute URL of the CSS source (or document URL for inline). */
  cssSourceUrl: string;
  /** Clone-relative path of THIS CSS file (used to compute relative refs). */
  ownClonePath: string;
  urlMap: UrlMap;
  /** Track unresolved external URLs back to the caller. */
  unresolved: Set<string>;
};

const URL_FUNC_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const AT_IMPORT_BARE_RE = /@import\s+(['"])([^'"]+)\1/g;

function rewriteToken(
  raw: string,
  args: RewriteArgs
): string {
  const cleaned = raw.trim();
  if (!cleaned) return raw;
  const lower = cleaned.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('#')) return raw;

  const abs = resolveUrl(args.cssSourceUrl, cleaned);
  if (!abs) return raw;

  const target = args.urlMap.get(abs);
  if (!target) {
    args.unresolved.add(abs);
    return abs;
  }
  return relativeFromClonePath(args.ownClonePath, target.cloneRelPath);
}

export function rewriteCss(args: RewriteArgs): string {
  const withUrls = args.css.replace(URL_FUNC_RE, (_match, quote: string, inner: string) => {
    const replaced = rewriteToken(inner, args);
    const q = quote || '"';
    return `url(${q}${replaced}${q})`;
  });

  const withImports = withUrls.replace(AT_IMPORT_BARE_RE, (_match, quote: string, inner: string) => {
    const replaced = rewriteToken(inner, args);
    return `@import ${quote}${replaced}${quote}`;
  });

  return withImports;
}
