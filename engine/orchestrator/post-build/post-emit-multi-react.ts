/**
 * Multi-page post-emit phase pipeline for the React target.
 *
 * After clone-urls.ts -> buildReactMulti emits the multi-page Vite project,
 * the captured @media rules in each per-page clone are still locked inside
 * /public/*.css. Most of those rules survive because each emitted <page>.html
 * keeps the source <link rel="stylesheet"> tags verbatim. But aggregation
 * across N pages tends to miss responsive declarations that only appeared on
 * a subset of crawled pages (the source cascade carried them via a stylesheet
 * that this particular page did not link).
 *
 * The fix mirrors what the astro post-emit does:
 *   1. extract-css across every per-page clone dir into analysis/css-rules.json
 *   2. media-preserve -> src/styles/responsive.css + base.css marker block
 *   3. (react specific) copy responsive.css into public/ and inject a
 *      <link rel="stylesheet" href="/dr-parity-responsive.css"> into every
 *      emitted <page>.html, so each page boots with the unified responsive
 *      sheet regardless of which source stylesheets it originally linked.
 *
 * Phases NOT executed here (astro specific): centralise-content,
 * edit-playbook, verify-render.
 *
 * Parity guarantee: this module is additive. It never rewrites the captured
 * head, never strips an existing link, and never reorders the source
 * cascade. The injected link sits at the END of each page's <head> so it
 * loses any specificity tie with earlier captured rules. That matches the
 * source site behaviour where the same @media block would have been
 * included via the last-loaded captured stylesheet anyway.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
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

const RESPONSIVE_PUBLIC_FILENAME = 'dr-parity-responsive.css';
const INJECTED_LINK_MARKER = 'data-dr-parity="responsive"';

export interface PostEmitMultiReactOptions {
  /** React project root (output of buildReactMulti). */
  outDir: string;
  /** Per-page clone dirs that were emitted into this project. */
  cloneDirs: string[];
  /** Log sink. Defaults to stdout. */
  log?: (line: string) => void;
}

export interface PostEmitMultiReactResult {
  analysisDir: string;
  cssRulesCount: number;
  mediaRuleCount: number;
  responsiveCssPath: string | null;
  publicCssPath: string | null;
  pagesPatched: number;
}

function defaultLog(line: string): void {
  process.stdout.write(line + '\n');
}

/**
 * Aggregate every clone dir's CSS into a single css-rules.json so that
 * media-preserve sees @media rules from ALL crawled pages, not just one.
 *
 * Behaviour-identical to the astro post-emit aggregator. Duplicated rather
 * than imported so the two pipelines can diverge without coupling.
 */
function aggregateCssRules(
  cloneDirs: string[],
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
      log(`  [extract-css] ${absDir}: +${added} rules (${rules.length} total parsed)`);
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
 * Patch every <outDir>/<pageName>.html so its <head> ends with a link to
 * the public responsive sheet. Idempotent: re-running will not duplicate
 * the injected link.
 */
function injectResponsiveLinkIntoPages(
  outDir: string,
  publicHref: string,
  log: (l: string) => void,
): number {
  let entries: string[];
  try {
    entries = readdirSync(outDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.html'))
      .map((e) => e.name);
  } catch (err) {
    log(`  [inject-link] failed to read ${outDir}: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }

  if (entries.length === 0) {
    log(`  [inject-link] no <page>.html files in ${outDir}; skipping injection.`);
    return 0;
  }

  const linkTag = `<link rel="stylesheet" href="${publicHref}" ${INJECTED_LINK_MARKER}>`;
  let patched = 0;

  for (const name of entries) {
    const filePath = join(outDir, name);
    let source: string;
    try {
      source = readFileSync(filePath, 'utf8');
    } catch (err) {
      log(`  [inject-link] read failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (source.includes(INJECTED_LINK_MARKER)) {
      // Already injected on a prior run. Leave it alone.
      patched += 1;
      continue;
    }

    const headCloseMatch = source.match(/<\/head>/i);
    if (!headCloseMatch || headCloseMatch.index === undefined) {
      log(`  [inject-link] no </head> tag in ${name}; skipping.`);
      continue;
    }
    const idx = headCloseMatch.index;
    const next = source.slice(0, idx) + `    ${linkTag}\n  ` + source.slice(idx);
    try {
      writeFileSync(filePath, next, 'utf8');
      patched += 1;
    } catch (err) {
      log(`  [inject-link] write failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return patched;
}

export async function runPostEmitMultiReact(
  options: PostEmitMultiReactOptions,
): Promise<PostEmitMultiReactResult> {
  const log = options.log ?? defaultLog;
  const outDir = resolve(options.outDir);

  const result: PostEmitMultiReactResult = {
    analysisDir: '',
    cssRulesCount: 0,
    mediaRuleCount: 0,
    responsiveCssPath: null,
    publicCssPath: null,
    pagesPatched: 0,
  };

  if (!existsSync(outDir)) {
    log(`post-emit-multi-react: outDir does not exist: ${outDir}; skipping.`);
    return result;
  }

  // -----------------------------------------------------------------
  // Phase 1: aggregate extract-css across every per-page clone dir.
  // -----------------------------------------------------------------
  log('\n=== Post-emit (react) 1/3: extract-css (aggregate) ===');
  const analysisDir = join(outDir, 'analysis');
  mkdirSync(analysisDir, { recursive: true });
  const rules = aggregateCssRules(options.cloneDirs, log);
  const cssRulesPath = join(analysisDir, 'css-rules.json');
  writeFileSync(cssRulesPath, JSON.stringify(rules, null, 2), 'utf8');
  result.analysisDir = analysisDir;
  result.cssRulesCount = rules.length;
  log(`  aggregated ${rules.length} unique CSS rules -> ${cssRulesPath}`);

  // -----------------------------------------------------------------
  // Phase 2: media-preserve -> src/styles/responsive.css + base.css.
  // -----------------------------------------------------------------
  log('\n=== Post-emit (react) 2/3: media-preserve ===');
  try {
    const stylesOutDir = join(outDir, 'src', 'styles');
    const media = preserveMediaRules({ analysisDir, stylesOutDir });
    result.responsiveCssPath = media.responsiveCssPath;
    result.mediaRuleCount = media.mediaRuleCount;
    log(
      `  ${media.mediaRuleCount} @media rules across ${media.uniqueMediaQueries} unique queries -> ${media.responsiveCssPath}`,
    );
  } catch (err) {
    log(`  media-preserve failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  // -----------------------------------------------------------------
  // Phase 3 (react specific): mirror responsive.css into /public and
  // inject a <link> into every emitted <page>.html so the rules load.
  // -----------------------------------------------------------------
  log('\n=== Post-emit (react) 3/3: publish responsive sheet + inject links ===');
  if (!result.responsiveCssPath || !existsSync(result.responsiveCssPath)) {
    log(`  responsive.css was not produced; nothing to publish.`);
    return result;
  }

  const publicDir = join(outDir, 'public');
  mkdirSync(publicDir, { recursive: true });
  const publicCssPath = join(publicDir, RESPONSIVE_PUBLIC_FILENAME);
  try {
    const css = readFileSync(result.responsiveCssPath, 'utf8');
    writeFileSync(publicCssPath, css, 'utf8');
    result.publicCssPath = publicCssPath;
    log(`  copied -> ${publicCssPath}`);
  } catch (err) {
    log(`  publish failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const publicHref = `/${RESPONSIVE_PUBLIC_FILENAME}`;
  result.pagesPatched = injectResponsiveLinkIntoPages(outDir, publicHref, log);
  log(`  link injected into ${result.pagesPatched} <page>.html file(s).`);

  // Persist a summary alongside emit artefacts.
  try {
    writeFileSync(
      join(outDir, 'post-emit-multi-react-summary.json'),
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          cloneDirs: options.cloneDirs,
          cssRulesCount: result.cssRulesCount,
          mediaRuleCount: result.mediaRuleCount,
          responsiveCssPath: result.responsiveCssPath,
          publicCssPath: result.publicCssPath,
          pagesPatched: result.pagesPatched,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
  } catch {
    // Non-fatal.
  }

  return result;
}
