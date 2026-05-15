/**
 * Multi-page post-emit phase pipeline.
 *
 * After clone-site.ts → buildAstroMulti emits the source tree, the
 * single-page orchestrator's post-emit phases (centralise-content,
 * edit-playbook, media-preserve, verify-render) are NOT invoked. This
 * module is the multi-page bridge: it runs the subset of phases that
 * apply to an already-emitted multi-page Astro project.
 *
 * Phases executed (in order):
 *   1. extract-css     (aggregate across every page clone dir → analysis/css-rules.json)
 *   2. media-preserve  (Phase 14) → src/styles/responsive.css + base.css marker
 *   3. centralise-content (Phase 12) → src/content/site.ts
 *   4. npm install + npm run build (Phase 9-equivalent)
 *   5. edit-playbook   (Phase 11) → EDIT.md
 *   6. verify-render   (Phase 13) → verify-render-report.json
 *
 * Phases NOT executed (already run per-page during the crawl, or
 * aggressive-only): scaffold, extract-tokens, extract-primitives,
 * iconify-svgs, refactor-sections, scope-styles, extract-animations,
 * wire-layout, verify-parity.
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import {
  discoverCssSources,
  parseSources,
} from '../../analyze/css/parser';
import type { CssRule } from '../../analyze/css/types';
import { preserveMediaRules } from '../../scope-styles/media-preserve';
import { centralizeContent } from '../../astro/centralize-content';
import { generateEditPlaybook } from '../../playbook/generate-edit-playbook';
import { verifyRender, type VerifyRenderReport } from '../../verify/render';

export interface PostEmitMultiOptions {
  /** Astro project root (output of buildAstroMulti). */
  outDir: string;
  /** Clone dirs that were emitted into this project. Used for CSS aggregation. */
  cloneDirs: string[];
  /** Skip npm install + build (useful for tests). */
  skipBuild?: boolean;
  /** Skip verify-render (useful for quick checks). */
  skipVerify?: boolean;
  /** Log sink. Defaults to stdout. */
  log?: (line: string) => void;
}

export interface PostEmitMultiResult {
  analysisDir: string;
  cssRulesCount: number;
  mediaRuleCount: number;
  responsiveCssPath: string | null;
  centralizedFields: number;
  centralizedFile: string | null;
  built: boolean;
  buildExitCode: number | null;
  playbookPath: string | null;
  verifyReport: VerifyRenderReport | null;
}

function defaultLog(line: string): void {
  process.stdout.write(line + '\n');
}

/**
 * Aggregate every clone dir's CSS into a single css-rules.json so that
 * Phase 14 (media-preserve) sees @media rules from ALL crawled pages,
 * not just the homepage.
 */
function aggregateCssRules(cloneDirs: string[], log: (l: string) => void): CssRule[] {
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
        // Dedup by (selector|mediaQuery|first-declaration). Cheap and stable.
        const firstDecl = rule.declarations[0];
        const fingerprint = [
          rule.selector,
          rule.mediaQuery ?? '',
          firstDecl ? `${firstDecl.prop}:${firstDecl.value}` : '',
          rule.declarations.length,
        ].join('');
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

function spawnInDir(
  cmd: string,
  args: string[],
  cwd: string,
  log: (line: string) => void,
): Promise<number> {
  return new Promise((resolveExit) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    child.stdout?.on('data', (c: Buffer) =>
      log(c.toString('utf8').replace(/\s+$/, '')),
    );
    child.stderr?.on('data', (c: Buffer) =>
      log(c.toString('utf8').replace(/\s+$/, '')),
    );
    child.on('error', (err) => {
      log(`spawn error: ${err.message}`);
      resolveExit(1);
    });
    child.on('exit', (code) => resolveExit(code ?? 0));
  });
}

export async function runPostEmitMulti(
  options: PostEmitMultiOptions,
): Promise<PostEmitMultiResult> {
  const log = options.log ?? defaultLog;
  const outDir = resolve(options.outDir);
  const skipBuild = options.skipBuild ?? false;
  const skipVerify = options.skipVerify ?? false;

  const result: PostEmitMultiResult = {
    analysisDir: '',
    cssRulesCount: 0,
    mediaRuleCount: 0,
    responsiveCssPath: null,
    centralizedFields: 0,
    centralizedFile: null,
    built: false,
    buildExitCode: null,
    playbookPath: null,
    verifyReport: null,
  };

  if (!existsSync(outDir)) {
    log(`post-emit-multi: outDir does not exist: ${outDir} — skipping.`);
    return result;
  }

  // ---------------------------------------------------------------------
  // Phase 1: aggregate extract-css across every per-page clone dir.
  // ---------------------------------------------------------------------
  log('\n=== Post-emit Phase 1/5: extract-css (aggregate) ===');
  const analysisDir = join(outDir, 'analysis');
  mkdirSync(analysisDir, { recursive: true });
  const rules = aggregateCssRules(options.cloneDirs, log);
  const cssRulesPath = join(analysisDir, 'css-rules.json');
  writeFileSync(cssRulesPath, JSON.stringify(rules, null, 2), 'utf8');
  result.analysisDir = analysisDir;
  result.cssRulesCount = rules.length;
  log(`  aggregated ${rules.length} unique CSS rules → ${cssRulesPath}`);

  // ---------------------------------------------------------------------
  // Phase 14: media-preserve (responsive.css + base.css marker block).
  // ---------------------------------------------------------------------
  log('\n=== Post-emit Phase 2/5: media-preserve (Phase 14) ===');
  try {
    const stylesOutDir = join(outDir, 'src', 'styles');
    const media = preserveMediaRules({ analysisDir, stylesOutDir });
    result.responsiveCssPath = media.responsiveCssPath;
    result.mediaRuleCount = media.mediaRuleCount;
    log(
      `  ${media.mediaRuleCount} @media rules across ${media.uniqueMediaQueries} unique queries → ${media.responsiveCssPath}`,
    );
  } catch (err) {
    log(
      `  media-preserve failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ---------------------------------------------------------------------
  // Phase 12: centralise content (src/content/site.ts).
  // ---------------------------------------------------------------------
  log('\n=== Post-emit Phase 3/5: centralise-content (Phase 12) ===');
  try {
    const summary = await centralizeContent(outDir);
    result.centralizedFields = summary.fieldsExtracted;
    result.centralizedFile = summary.contentFile;
    log(
      `  sections=${summary.sectionsScanned} fields=${summary.fieldsExtracted} rewrites=${summary.filesRewritten}`,
    );
  } catch (err) {
    log(
      `  centralise-content failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ---------------------------------------------------------------------
  // Phase 9: npm install + npm run build.
  // ---------------------------------------------------------------------
  if (!skipBuild) {
    if (!existsSync(join(outDir, 'package.json'))) {
      log('  post-emit-multi: no package.json in outDir; skipping build.');
    } else {
      if (!existsSync(join(outDir, 'node_modules'))) {
        log('\n=== Post-emit Phase 4/5: npm install ===');
        const installCode = await spawnInDir(
          'npm',
          ['install', '--silent'],
          outDir,
          log,
        );
        if (installCode !== 0) {
          log(`  npm install failed (exit ${installCode}); aborting build.`);
          result.buildExitCode = installCode;
          return result;
        }
      }
      log('\n=== Post-emit Phase 4/5: npm run build ===');
      const buildExitCode = await spawnInDir(
        'npm',
        ['run', 'build'],
        outDir,
        log,
      );
      result.buildExitCode = buildExitCode;
      result.built = buildExitCode === 0;
      if (!result.built) {
        log(`  npm run build failed (exit ${buildExitCode}).`);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Phase 11: edit-playbook (EDIT.md).
  // ---------------------------------------------------------------------
  log('\n=== Post-emit Phase 5a/5: edit-playbook (Phase 11) ===');
  try {
    const playbook = generateEditPlaybook(outDir);
    result.playbookPath = playbook.path;
    log(`  EDIT.md → ${playbook.path}`);
  } catch (err) {
    log(
      `  edit-playbook failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ---------------------------------------------------------------------
  // Phase 13: verify-render (boot dev server, smoke-test routes).
  // ---------------------------------------------------------------------
  if (!skipVerify && result.built) {
    log('\n=== Post-emit Phase 5b/5: verify-render (Phase 13) ===');
    try {
      result.verifyReport = await verifyRender({ outDir, log });
      const r = result.verifyReport;
      log(
        `  verify-render: ${r.passed}/${r.routesChecked} routes passed` +
          (r.failed > 0 ? ` (${r.failed} failed)` : ''),
      );
    } catch (err) {
      log(
        `  verify-render crashed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else if (skipVerify) {
    log('  verify-render: skipped (skipVerify=true).');
  } else {
    log('  verify-render: skipped (build did not succeed).');
  }

  // Persist a summary alongside emit artefacts.
  try {
    writeFileSync(
      join(outDir, 'post-emit-multi-summary.json'),
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          cloneDirs: options.cloneDirs,
          cssRulesCount: result.cssRulesCount,
          mediaRuleCount: result.mediaRuleCount,
          centralizedFields: result.centralizedFields,
          built: result.built,
          buildExitCode: result.buildExitCode,
          verify: result.verifyReport
            ? {
                routesChecked: result.verifyReport.routesChecked,
                passed: result.verifyReport.passed,
                failed: result.verifyReport.failed,
                serverError: result.verifyReport.serverError,
              }
            : null,
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

/**
 * Tiny helper used by callers that already have a serialised CssRule list and
 * want to bypass discoverCssSources (currently unused but exported so tests
 * can poke individual phases).
 */
export function writeAggregatedRulesFile(
  analysisDir: string,
  rules: CssRule[],
): string {
  mkdirSync(analysisDir, { recursive: true });
  const path = join(analysisDir, 'css-rules.json');
  writeFileSync(path, JSON.stringify(rules, null, 2), 'utf8');
  return path;
}

