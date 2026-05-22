/**
 * Multi-page post-emit phase pipeline for the React target.
 *
 * History: this module used to (a) aggregate CSS, (b) run media-preserve,
 * (c) publish responsive.css into /public, and (d) patch every emitted
 * <page>.html to add a <link rel="stylesheet"> tag. Step (d) was a silent
 * regression risk: a re-emit run would overwrite the patched HTML and
 * silently drop the link.
 *
 * W5A.4 moved (a) (b) (c) into engine/targets/react/responsive-sheet.ts,
 * which is now called from buildReactMulti BEFORE emit so the href can be
 * baked into each slice's extraStylesheetHrefs. The emit step writes the
 * <link> directly. Re-emitting reproduces the same tag deterministically.
 *
 * This module now exists as a thin shim:
 *   1. Re-run buildResponsiveSheet so the analysis JSON and responsive.css
 *      are refreshed on a post-emit-only invocation (idempotent).
 *   2. Report the same summary shape callers (scripts/clone-urls.ts) used
 *      to consume.
 *   3. Do NOT touch any <page>.html. The emit step is the only writer.
 *
 * Astro pipeline is untouched: see engine/orchestrator/post-build/post-emit-multi.ts.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { buildResponsiveSheet } from '../../targets/react/responsive-sheet';

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
  /**
   * Always 0 from W5A.4 onward — the emit step writes the <link> tags now.
   * Kept in the result shape so existing CLI logging keeps working without
   * a coupled change in scripts/clone-urls.ts.
   */
  pagesPatched: number;
}

function defaultLog(line: string): void {
  process.stdout.write(line + '\n');
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

  log('\n=== Post-emit (react): refresh responsive sheet (no HTML patch) ===');
  const sheet = buildResponsiveSheet({
    outDir,
    cloneDirs: options.cloneDirs,
    log,
  });

  result.analysisDir = sheet.analysisDir;
  result.cssRulesCount = sheet.cssRulesCount;
  result.mediaRuleCount = sheet.mediaRuleCount;
  result.responsiveCssPath = sheet.responsiveCssPath;
  result.publicCssPath = sheet.publicCssPath;

  // Persist a summary alongside emit artefacts for parity with the legacy
  // post-emit shape.
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
          note:
            'pagesPatched is always 0 from W5A.4 onward: link injection now happens at emit time via buildReactMulti.',
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
