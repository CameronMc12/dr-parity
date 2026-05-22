/**
 * Build the dr-parity responsive @media sheet for a multi-page React emit.
 *
 * The astro target lets each page's <link rel="stylesheet"> carry the source
 * cascade verbatim because SiteLayout imports base.css. The react target
 * emits one real HTML entry per page, and cross-page aggregation tends to
 * miss responsive declarations that only appeared on a subset of crawled
 * pages (the source cascade carried them via a stylesheet that this
 * particular page did not link).
 *
 * The fix runs at emit time (NOT post-emit) so the injected <link> survives
 * a re-emit. The pipeline:
 *
 *   1. Aggregate CSS rules across every per-page clone dir into
 *      <outDir>/analysis/css-rules.json (target-agnostic).
 *   2. Call preserveMediaRules() to produce <outDir>/src/styles/responsive.css.
 *   3. Mirror responsive.css into <outDir>/public/ so each <page>.html can
 *      link it from a stable URL-absolute path.
 *
 * The caller (buildReactMulti) then prepends the resulting public href to
 * every page slice's extraStylesheetHrefs so the link is written at emit
 * time, not patched after.
 *
 * Parity guarantee: this module never mutates HTML. It only produces a CSS
 * file and reports a stable href. The emit step does the link writing.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import {
  discoverCssSources,
  parseSources,
} from '../../analyze/css/parser';
import type { CssRule } from '../../analyze/css/types';
import { preserveMediaRules } from '../../scope-styles/media-preserve';

export const RESPONSIVE_PUBLIC_FILENAME = 'dr-parity-responsive.css';
export const RESPONSIVE_PUBLIC_HREF = `/${RESPONSIVE_PUBLIC_FILENAME}`;

export interface BuildResponsiveSheetOptions {
  /** React project root (output of buildReactMulti). */
  outDir: string;
  /** Per-page clone dirs that feed this emit. */
  cloneDirs: readonly string[];
  /** Log sink. Defaults to a no-op so embedded calls stay quiet. */
  log?: (line: string) => void;
}

export interface BuildResponsiveSheetResult {
  analysisDir: string;
  cssRulesCount: number;
  mediaRuleCount: number;
  /** Path to <outDir>/src/styles/responsive.css. Null if no rules captured. */
  responsiveCssPath: string | null;
  /** Path to <outDir>/public/dr-parity-responsive.css. Null if not published. */
  publicCssPath: string | null;
  /** URL-absolute href to inject into each page's head. Null if not published. */
  publicHref: string | null;
}

function noopLog(_line: string): void {}

/**
 * Aggregate every clone dir's CSS into a deduped CssRule[]. Same fingerprint
 * heuristic as the post-emit pipelines: selector + media + first declaration
 * + declaration count.
 */
function aggregateCssRules(
  cloneDirs: readonly string[],
  log: (l: string) => void,
): CssRule[] {
  const seen = new Set<string>();
  const all: CssRule[] = [];
  for (const dir of cloneDirs) {
    const absDir = resolve(dir);
    if (!existsSync(absDir)) {
      log(`  [extract-css] skip missing clone: ${absDir}`);
      continue;
    }
    try {
      const { sources } = discoverCssSources(absDir);
      const { rules } = parseSources(sources);
      let added = 0;
      for (const rule of rules) {
        const firstDecl = rule.declarations[0];
        const fingerprint = [
          rule.selector,
          rule.mediaQuery ?? '',
          firstDecl ? `${firstDecl.prop}:${firstDecl.value}` : '',
          rule.declarations.length,
        ].join('');
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        all.push(rule);
        added += 1;
      }
      log(`  [extract-css] ${absDir}: +${added} rules (${rules.length} parsed)`);
    } catch (err) {
      log(
        `  [extract-css] failed for ${absDir}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  return all;
}

/**
 * Produce <outDir>/public/dr-parity-responsive.css from the union of
 * @media rules across every captured clone dir. Returns a stable URL-absolute
 * href that callers can splice into each page's extraStylesheetHrefs at emit
 * time.
 *
 * Idempotent: re-running overwrites the analysis JSON, responsive.css, and
 * public copy with the same content (modulo capture changes).
 */
export function buildResponsiveSheet(
  options: BuildResponsiveSheetOptions,
): BuildResponsiveSheetResult {
  const log = options.log ?? noopLog;
  const outDir = resolve(options.outDir);

  const result: BuildResponsiveSheetResult = {
    analysisDir: '',
    cssRulesCount: 0,
    mediaRuleCount: 0,
    responsiveCssPath: null,
    publicCssPath: null,
    publicHref: null,
  };

  if (!existsSync(outDir)) {
    log(`build-responsive-sheet: outDir does not exist: ${outDir}; skipping.`);
    return result;
  }

  const analysisDir = join(outDir, 'analysis');
  mkdirSync(analysisDir, { recursive: true });
  result.analysisDir = analysisDir;

  const rules = aggregateCssRules(options.cloneDirs, log);
  const cssRulesPath = join(analysisDir, 'css-rules.json');
  writeFileSync(cssRulesPath, JSON.stringify(rules, null, 2), 'utf8');
  result.cssRulesCount = rules.length;
  log(`  aggregated ${rules.length} unique CSS rules -> ${cssRulesPath}`);

  let responsiveCssPath: string | null = null;
  try {
    const stylesOutDir = join(outDir, 'src', 'styles');
    const media = preserveMediaRules({ analysisDir, stylesOutDir });
    responsiveCssPath = media.responsiveCssPath;
    result.responsiveCssPath = responsiveCssPath;
    result.mediaRuleCount = media.mediaRuleCount;
    log(
      `  ${media.mediaRuleCount} @media rules across ${media.uniqueMediaQueries} queries -> ${media.responsiveCssPath}`,
    );
  } catch (err) {
    log(`  media-preserve failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  if (!responsiveCssPath || !existsSync(responsiveCssPath)) {
    log(`  responsive.css was not produced; nothing to publish.`);
    return result;
  }

  const publicDir = join(outDir, 'public');
  mkdirSync(publicDir, { recursive: true });
  const publicCssPath = join(publicDir, RESPONSIVE_PUBLIC_FILENAME);
  try {
    const css = readFileSync(responsiveCssPath, 'utf8');
    writeFileSync(publicCssPath, css, 'utf8');
    result.publicCssPath = publicCssPath;
    result.publicHref = RESPONSIVE_PUBLIC_HREF;
    log(`  copied -> ${publicCssPath}`);
  } catch (err) {
    log(`  publish failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  return result;
}
