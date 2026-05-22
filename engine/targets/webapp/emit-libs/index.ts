/**
 * Phase 6 orchestrator: detect → install deps → emit wrapper files →
 * attribute-rewrite emitted JSX → write OUTPUT.md.
 *
 * Wrapper templates live as `.tsx.tpl` files alongside this folder so tsc
 * leaves them alone. The emitter copies them verbatim into
 * `<outDir>/src/lib/<libId>.tsx` (skipping if the file already exists).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectLibs } from '../detect-libs/detect';
import type { DetectedLib, LibDetectionResult } from '../detect-libs/types';

import { mergeDependencies } from './install-deps';
import { rewriteAttributes } from './emit-attribute-rewrite';
import { writeOutputReport } from './emit-output-report';
import type { EmitLibsResult, EmittedWrapper } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const WRAPPERS_DIR = join(HERE, 'wrappers');

function templatePath(libId: string): string {
  return join(WRAPPERS_DIR, `${libId}.tsx.tpl`);
}

function emitWrapperFiles(
  outDir: string,
  detected: DetectedLib[],
): EmittedWrapper[] {
  const emitted: EmittedWrapper[] = [];
  for (const lib of detected) {
    if (lib.signature.swapStrategy === 'manual-only') continue;
    const tpl = templatePath(lib.signature.id);
    if (!existsSync(tpl)) continue;
    const dest = join(outDir, lib.signature.reactEquivalent.wrapperPath);
    if (existsSync(dest)) {
      emitted.push({ libId: lib.signature.id, outPath: dest, skipped: true });
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    const body = readFileSync(tpl, 'utf8');
    writeFileSync(dest, body, 'utf8');
    emitted.push({ libId: lib.signature.id, outPath: dest, skipped: false });
  }
  return emitted;
}

function listEmittedTsx(rootDir: string): string[] {
  if (!existsSync(rootDir)) return [];
  const found: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const abs = join(dir, name);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(abs);
      } else if (name.endsWith('.tsx')) {
        found.push(abs);
      }
    }
  }
  return found;
}

function applyAttributeRewrites(
  outDir: string,
  detection: LibDetectionResult,
): void {
  const targets = [
    join(outDir, 'src', 'components'),
    join(outDir, 'src', 'pages'),
  ];
  const allDetected = [...detection.detected, ...detection.manualOnly];
  const attrLibs = allDetected.filter(
    (d) => d.signature.swapStrategy === 'attribute-rewrite',
  );
  if (attrLibs.length === 0) return;
  for (const dir of targets) {
    for (const file of listEmittedTsx(dir)) {
      const before = readFileSync(file, 'utf8');
      const after = rewriteAttributes(before, attrLibs);
      if (after !== before) writeFileSync(file, after, 'utf8');
    }
  }
}

export async function emitLibs(
  crawlDir: string,
  outDir: string,
): Promise<EmitLibsResult> {
  const detection = await detectLibs(crawlDir);

  const pkgJsonPath = join(outDir, 'package.json');
  const deps = await mergeDependencies(pkgJsonPath, detection.detected);

  const wrappers = emitWrapperFiles(outDir, detection.detected);

  applyAttributeRewrites(outDir, detection);

  const reportPath = await writeOutputReport(outDir, detection, deps);

  return {
    detection,
    wrappers,
    deps,
    reportPath,
    unknown: detection.unknown,
    manualOnly: detection.manualOnly,
  };
}

export type { EmitLibsResult } from './types';
