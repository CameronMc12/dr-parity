/**
 * Pipeline phase definitions for rebuild-pro.
 *
 * Each phase is described declaratively so the runner can iterate, skip,
 * or re-run them without bespoke per-phase glue.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import type {
  InlineResult,
  OrchestratorContext,
  PhaseDefinition,
} from './types';
import { wireLayout } from './wire-layout';
import { generateEditPlaybook } from '../playbook/generate-edit-playbook';
import { centralizeContent } from '../astro/centralize-content';
// VERIFY-AGENT: import added for Phase 13 (verify-render post-build smoke test).
import { verifyRender } from '../verify/render';
// MEDIA-AGENT: Phase 14 preserves captured @media rules in both safe and aggressive modes.
import { preserveMediaRules } from '../scope-styles/media-preserve';

function npmRun(scriptName: string, args: string[], cwd: string): PhaseDefinition['command'] {
  return {
    cmd: 'npm',
    args: ['run', scriptName, '--', ...args],
    cwd,
  };
}

function runInDir(cmd: string, args: string[], cwd: string): PhaseDefinition['command'] {
  return { cmd, args, cwd };
}

function buildScaffoldInline(): (ctx: OrchestratorContext) => Promise<InlineResult> {
  return async (ctx) => {
    if (existsSync(ctx.outDir) && !ctx.force) {
      throw new Error(
        `Output directory exists: ${ctx.outDir}. Pass --force to overwrite.`,
      );
    }
    const args = ['run', 'build-astro', '--', ctx.cloneDir, `--out=${ctx.outDir}`];
    if (ctx.force) args.push('--force');
    await new Promise<void>((resolveSpawn, rejectSpawn) => {
      const child = spawn('npm', args, {
        cwd: ctx.repoRoot,
        stdio: ['ignore', 'inherit', 'inherit'],
        env: process.env,
      });
      child.on('error', rejectSpawn);
      child.on('close', (code) => {
        if (code === 0) resolveSpawn();
        else rejectSpawn(new Error(`build-astro exited with code ${code}`));
      });
    });
    if (!existsSync(ctx.outDir)) {
      throw new Error(`Scaffold did not produce ${ctx.outDir}`);
    }
    return { outputs: [ctx.outDir] };
  };
}

function buildAnalysisDirInline(): (ctx: OrchestratorContext) => Promise<InlineResult> {
  return async (ctx) => {
    mkdirSync(ctx.analysisDir, { recursive: true });
    return { outputs: [ctx.analysisDir] };
  };
}

export function buildPhases(ctx: OrchestratorContext): PhaseDefinition[] {
  const repoRoot = ctx.repoRoot;
  const out = ctx.outDir;
  const clone = ctx.cloneDir;
  const analysis = ctx.analysisDir;
  const primitivesConfig = ctx.primitivesConfig;

  const phases: PhaseDefinition[] = [];

  phases.push({
    id: 0,
    slug: 'scaffold',
    label: 'scaffold (build-astro)',
    command: null,
    inline: buildScaffoldInline(),
    outputs: [out],
  });

  phases.push({
    id: 1,
    slug: 'extract-css',
    label: 'extract-css',
    command: null,
    inline: async (innerCtx) => {
      await buildAnalysisDirInline()(innerCtx);
      return new Promise<InlineResult>((resolveSpawn, rejectSpawn) => {
        const child = spawn(
          'npm',
          ['run', 'extract:css', '--', clone, `--out=${analysis}`],
          { cwd: repoRoot, stdio: ['ignore', 'inherit', 'inherit'], env: process.env },
        );
        child.on('error', rejectSpawn);
        child.on('close', (code) => {
          if (code === 0) resolveSpawn({ outputs: [analysis] });
          else rejectSpawn(new Error(`extract:css exited with code ${code}`));
        });
      });
    },
    outputs: [analysis],
  });

  phases.push({
    id: 2,
    slug: 'extract-tokens',
    label: 'extract-tokens',
    command: npmRun(
      'extract:tokens',
      [analysis, `--out=${join(out, 'src/styles')}`, '--force'],
      repoRoot,
    ),
    outputs: [join(out, 'src/styles/tokens.css'), join(out, 'src/styles/token-map.json')],
  });

  const primitivesArgs = [
    analysis,
    `--out=${join(out, 'src/components/primitives')}`,
    '--force',
  ];
  if (primitivesConfig) primitivesArgs.push(`--config=${primitivesConfig}`);
  phases.push({
    id: 3,
    slug: 'extract-primitives',
    label: 'extract-primitives',
    command: npmRun('extract:primitives', primitivesArgs, repoRoot),
    outputs: [join(out, 'src/components/primitives')],
  });

  phases.push({
    id: 4,
    slug: 'iconify-svgs',
    label: 'iconify-svgs',
    command: npmRun(
      'iconify:svgs',
      [clone, `--out=${join(out, 'src/components/icons')}`, '--force'],
      repoRoot,
    ),
    outputs: [join(out, 'src/components/icons')],
  });

  // MEDIA-AGENT: Phase 14 runs in BOTH safe and aggressive modes. It reads
  // analysis/css-rules.json and emits src/styles/responsive.css plus a
  // marker block appended to base.css so the layout's existing import
  // picks it up without touching wire-layout. Aggressive scope-styles
  // (Phase 6) detects the marker and skips re-emitting @media rules.
  phases.push({
    id: 14,
    slug: 'media-preserve',
    label: 'preserve captured @media rules',
    command: null,
    inline: async (innerCtx) => {
      const result = preserveMediaRules({
        analysisDir: innerCtx.analysisDir,
        stylesOutDir: join(innerCtx.outDir, 'src/styles'),
      });
      const warning =
        result.mediaRuleCount === 0
          ? 'No @media rules found in css-rules.json'
          : undefined;
      const inlineResult: InlineResult = {
        outputs: [result.responsiveCssPath, result.baseCssPath],
      };
      if (warning) inlineResult.warning = warning;
      return inlineResult;
    },
    outputs: [join(out, 'src/styles/responsive.css'), join(out, 'src/styles/base.css')],
  });

  phases.push({
    id: 5,
    slug: 'refactor-sections',
    label: 'refactor-sections',
    command: {
      cmd: 'npx',
      args: [
        'tsx',
        'scripts/refactor-sections.ts',
        `--components-dir=${join(out, 'src/components')}`,
        `--primitive-map=${join(out, 'src/components/primitives/primitive-map.json')}`,
        `--icon-swap-map=${join(out, 'src/components/icons/dom-swap-map.json')}`,
        '--primitive-import-base=./primitives',
        '--icon-import-base=./icons',
        `--mode=${ctx.mode}`,
        '--force',
      ],
      cwd: repoRoot,
    },
    outputs: [join(out, 'src/components')],
    requiresMode: 'aggressive',
    parityCheck: true,
  });

  phases.push({
    id: 6,
    slug: 'scope-styles',
    label: 'scope-styles',
    command: npmRun(
      'scope:styles',
      [
        analysis,
        `--components-dir=${join(out, 'src/components')}`,
        `--styles-out-dir=${join(out, 'src/styles')}`,
        `--token-map=${join(out, 'src/styles/token-map.json')}`,
        `--mode=${ctx.scopeStylesMode}`,
        '--force',
      ],
      repoRoot,
    ),
    outputs: [join(out, 'src/styles')],
    requiresMode: 'aggressive',
    parityCheck: true,
  });

  phases.push({
    id: 7,
    slug: 'extract-animations',
    label: 'extract-animations',
    command: npmRun(
      'extract:animations',
      [clone, `--out=${join(out, 'src/lib/animations')}`, '--force'],
      repoRoot,
    ),
    outputs: [join(out, 'src/lib/animations')],
  });

  phases.push({
    id: 8,
    slug: 'wire-layout',
    label: 'wire tokens + overrides + animations',
    command: null,
    inline: wireLayout,
    outputs: [join(out, 'src/layouts/SiteLayout.astro')],
  });

  // Phase order: centralise content runs AFTER wire-layout (so all sections
  // are in their final shape) and BEFORE build (so the import resolves).
  phases.push({
    id: 12,
    slug: 'centralize-content',
    label: 'centralise editable copy → src/content/site.ts',
    command: null,
    inline: async (innerCtx) => {
      const summary = await centralizeContent(innerCtx.outDir);
      const outputs: string[] = [];
      if (summary.contentFile) outputs.push(summary.contentFile);
      return { outputs };
    },
    outputs: [join(out, 'src/content/site.ts')],
  });

  phases.push({
    id: 9,
    slug: 'build',
    label: 'build verification (npm run build)',
    command: null,
    inline: async () => {
      const hasModules = existsSync(join(out, 'node_modules'));
      if (!hasModules) {
        await new Promise<void>((resolveSpawn, rejectSpawn) => {
          const child = spawn('npm', ['install', '--silent'], {
            cwd: out,
            stdio: ['ignore', 'inherit', 'inherit'],
            env: process.env,
          });
          child.on('error', rejectSpawn);
          child.on('close', (code) => {
            if (code === 0) resolveSpawn();
            else rejectSpawn(new Error(`npm install exited with code ${code}`));
          });
        });
      }
      await new Promise<void>((resolveSpawn, rejectSpawn) => {
        const child = spawn('npm', ['run', 'build'], {
          cwd: out,
          stdio: ['ignore', 'inherit', 'inherit'],
          env: process.env,
        });
        child.on('error', rejectSpawn);
        child.on('close', (code) => {
          if (code === 0) resolveSpawn();
          else rejectSpawn(new Error(`build exited with code ${code}`));
        });
      });
      return { outputs: [join(out, 'dist')] };
    },
    outputs: [join(out, 'dist')],
  });

  phases.push({
    id: 10,
    slug: 'verify-parity',
    label: 'verify-parity',
    command: runInDir(
      'npm',
      [
        'run',
        'verify:parity',
        '--',
        `--clone=${clone}`,
        `--rebuilt=${join(out, 'dist')}`,
        '--threshold=0.01',
      ],
      repoRoot,
    ),
    outputs: [join(out, 'parity-report')],
    nonFatal: true,
  });

  phases.push({
    id: 11,
    slug: 'edit-playbook',
    label: 'edit-playbook (generate EDIT.md)',
    command: null,
    inline: async (innerCtx) => {
      if (!existsSync(innerCtx.outDir)) {
        return { warning: 'output directory missing; skipping playbook' };
      }
      const result = generateEditPlaybook(innerCtx.outDir);
      return { outputs: [result.path] };
    },
    outputs: [join(out, 'EDIT.md')],
    nonFatal: true,
  });

  // VERIFY-AGENT: Phase 13 — post-build smoke test. Boots `npm run dev`,
  // crawls every src/pages/*.astro route, and asserts the body renders
  // visible content. Catches "build clean, page blank" regressions that a
  // plain `astro build` cannot detect (e.g. the fluid.glass incident).
  phases.push({
    id: 13,
    slug: 'verify-render',
    label: 'verify-render (post-build smoke test)',
    command: null,
    inline: async (innerCtx) => {
      if (!existsSync(innerCtx.outDir)) {
        return { warning: 'output directory missing; skipping verify-render' };
      }
      if (!existsSync(join(innerCtx.outDir, 'package.json'))) {
        return { warning: 'no package.json in output; skipping verify-render' };
      }
      const report = await verifyRender({ outDir: innerCtx.outDir });
      const reportPath = join(innerCtx.outDir, 'verify-render-report.json');
      if (report.serverError) {
        return {
          outputs: [reportPath],
          warning: `verify-render: dev server failed to start: ${report.serverError}`,
        };
      }
      if (report.failed > 0) {
        const failing = report.routes
          .filter((r) => r.status === 'fail')
          .map((r) => `${r.route} (${r.reason ?? 'unknown'})`)
          .join(', ');
        process.stdout.write(
          `\n!!! verify-render WARNING: ${report.failed}/${report.routesChecked} routes rendered blank or errored.\n` +
            `    Failing: ${failing}\n` +
            `    Report : ${reportPath}\n\n`,
        );
        return {
          outputs: [reportPath],
          warning: `verify-render: ${report.failed}/${report.routesChecked} routes failed`,
        };
      }
      return { outputs: [reportPath] };
    },
    outputs: [join(out, 'verify-render-report.json')],
    nonFatal: true,
  });

  return phases;
}
