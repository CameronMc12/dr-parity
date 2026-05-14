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

  return phases;
}
