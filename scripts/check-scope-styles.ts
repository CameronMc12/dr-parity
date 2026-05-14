#!/usr/bin/env tsx
/**
 * Fixture check for scope-styles --mode={safe,aggressive}.
 *
 * Safe mode must:
 *   - leave every .astro file untouched
 *   - NOT write base.css
 *   - write analysis/scope-styles-plan.json
 *
 * Aggressive mode must:
 *   - inject a <style is:global> block into at least one .astro file
 *   - write base.css to the styles dir
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SCOPE_STYLES_SCRIPT = join(REPO_ROOT, 'scripts/scope-styles.ts');

const FIXTURE_CSS_RULES = [
  {
    selector: '.hero',
    declarations: [
      { prop: 'background', value: '#ff5546' },
      { prop: 'color', value: 'white' },
    ],
    mediaQuery: null,
  },
  {
    selector: 'body',
    declarations: [{ prop: 'margin', value: '0' }],
    mediaQuery: null,
  },
];

const FIXTURE_COMPONENT = `---
const title = 'Hero';
---

<section class="hero">
  <h1>{title}</h1>
</section>
`;

interface Workspace {
  root: string;
  analysisDir: string;
  componentsDir: string;
  stylesOutDir: string;
  componentFile: string;
}

function setupWorkspace(): Workspace {
  const root = mkdtempSync(join(tmpdir(), 'scope-styles-check-'));
  const analysisDir = join(root, 'analysis');
  const componentsDir = join(root, 'components');
  const stylesOutDir = join(root, 'styles');
  mkdirSync(analysisDir, { recursive: true });
  mkdirSync(componentsDir, { recursive: true });
  mkdirSync(stylesOutDir, { recursive: true });
  writeFileSync(
    join(analysisDir, 'css-rules.json'),
    JSON.stringify(FIXTURE_CSS_RULES, null, 2),
    'utf8',
  );
  const componentFile = join(componentsDir, 'Hero.astro');
  writeFileSync(componentFile, FIXTURE_COMPONENT, 'utf8');
  return { root, analysisDir, componentsDir, stylesOutDir, componentFile };
}

function runScopeStyles(workspace: Workspace, mode: 'safe' | 'aggressive'): void {
  const result = spawnSync(
    'npx',
    [
      'tsx',
      SCOPE_STYLES_SCRIPT,
      workspace.analysisDir,
      `--components-dir=${workspace.componentsDir}`,
      `--styles-out-dir=${workspace.stylesOutDir}`,
      `--mode=${mode}`,
      '--force',
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', env: process.env },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`scope-styles --mode=${mode} exited with status ${result.status ?? '?'}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`assertion failed: ${message}`);
  }
}

function checkSafeMode(): void {
  const workspace = setupWorkspace();
  try {
    const originalComponent = readFileSync(workspace.componentFile, 'utf8');
    runScopeStyles(workspace, 'safe');

    const afterComponent = readFileSync(workspace.componentFile, 'utf8');
    assert(
      afterComponent === originalComponent,
      `safe mode modified ${workspace.componentFile}`,
    );

    const baseCssPath = join(workspace.stylesOutDir, 'base.css');
    assert(
      !existsSync(baseCssPath),
      `safe mode emitted base.css at ${baseCssPath}`,
    );

    const planPath = join(workspace.analysisDir, 'scope-styles-plan.json');
    assert(existsSync(planPath), `safe mode did not write ${planPath}`);
    const plan: unknown = JSON.parse(readFileSync(planPath, 'utf8'));
    assert(
      typeof plan === 'object' &&
        plan !== null &&
        (plan as { mode?: unknown }).mode === 'analysis-only',
      'scope-styles-plan.json is missing { mode: "analysis-only" }',
    );

    process.stdout.write('safe mode      OK\n');
  } finally {
    rmSync(workspace.root, { recursive: true, force: true });
  }
}

function checkAggressiveMode(): void {
  const workspace = setupWorkspace();
  try {
    runScopeStyles(workspace, 'aggressive');

    const afterComponent = readFileSync(workspace.componentFile, 'utf8');
    assert(
      afterComponent.includes('<style is:global>'),
      `aggressive mode did not inject <style is:global> into ${workspace.componentFile}`,
    );

    const baseCssPath = join(workspace.stylesOutDir, 'base.css');
    assert(existsSync(baseCssPath), `aggressive mode did not write ${baseCssPath}`);

    process.stdout.write('aggressive mode OK\n');
  } finally {
    rmSync(workspace.root, { recursive: true, force: true });
  }
}

function main(): void {
  try {
    checkSafeMode();
    checkAggressiveMode();
    process.stdout.write('check-scope-styles: all checks passed\n');
  } catch (err) {
    process.stderr.write(
      `check-scope-styles failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

main();
