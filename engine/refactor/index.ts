import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assembleAstroFile,
  buildUpdatedFrontmatter,
  hasRefactorMarker,
  splitFrontmatter,
} from './frontmatter';
import {
  buildNormalisedSwapIndex,
  loadIconSwapMap,
  loadPrimitiveMap,
} from './load-maps';
import { prettifyAstro } from './prettify';
import {
  bumpCount,
  emptyReport,
  emptyProtectionCounters,
  mergeProtection,
  writeReport,
  renderSummaryTable,
} from './report';
import type {
  NormalisedSwapEntry,
  PrimitiveMap,
  RefactorOptions,
  RefactorReport,
  SectionRefactorResult,
} from './types';
import { refactorBody } from './walk';

const SKIP_BASENAMES = new Set([
  'index.astro',
  'SiteLayout.astro',
  'BodyPreamble.astro',
  'BodyPostamble.astro',
  'Main.astro',
]);

const SKIP_DIRNAMES = new Set(['primitives', 'icons']);

export async function runRefactor(
  options: RefactorOptions,
): Promise<{ report: RefactorReport; reportPath: string }> {
  await assertDir(options.componentsDir, 'components-dir');

  const [primitiveMap, iconSwapMap] = await Promise.all([
    loadPrimitiveMap(options.primitiveMapPath),
    loadIconSwapMap(options.iconSwapMapPath),
  ]);
  const iconIndex = buildNormalisedSwapIndex(iconSwapMap);

  const astroFiles = await collectAstroFiles(options.componentsDir);
  const report = emptyReport();

  for (const filePath of astroFiles) {
    report.filesScanned += 1;
    const basename = path.basename(filePath);
    const relPath = path.relative(options.componentsDir, filePath);

    try {
      const result = await processFile(filePath, primitiveMap, iconIndex, options);
      if (!result.changed) {
        if (result.reason) {
          report.filesSkipped.push({ path: relPath, reason: result.reason });
        }
        continue;
      }
      report.filesRefactored += 1;
      for (const p of result.primitivesUsed) bumpCount(report.primitivesUsed, p);
      for (const i of result.iconsUsed) bumpCount(report.iconsUsed, i);
      if (result.classSwaps > 0) {
        report.classSwapsBySection[basename] = result.classSwaps;
      }
      if (result.iconSwaps > 0) {
        report.iconSwapsBySection[basename] = result.iconSwaps;
      }
      mergeProtection(report.protection, result.protection);
    } catch (err) {
      report.filesSkipped.push({
        path: relPath,
        reason: `error: ${(err as Error).message}`,
      });
    }
  }

  const reportPath = await writeReport(options.componentsDir, report);
  return { report, reportPath };
}

async function processFile(
  filePath: string,
  primitiveMap: PrimitiveMap,
  iconIndex: NormalisedSwapEntry[],
  options: RefactorOptions,
): Promise<SectionRefactorResult> {
  const original = await readFile(filePath, 'utf8');

  if (hasRefactorMarker(original) && !options.force) {
    return {
      filePath,
      changed: false,
      primitivesUsed: new Set(),
      iconsUsed: new Set(),
      classSwaps: 0,
      iconSwaps: 0,
      protection: emptyProtectionCounters(),
      reason: 'already refactored (use --force to override)',
    };
  }

  const { frontmatter, body } = splitFrontmatter(original);
  const walk = refactorBody(body, primitiveMap, iconIndex);

  if (walk.primitivesUsed.size === 0 && walk.iconsUsed.size === 0) {
    return {
      filePath,
      changed: false,
      primitivesUsed: new Set(),
      iconsUsed: new Set(),
      classSwaps: 0,
      iconSwaps: 0,
      protection: walk.protection,
      reason: 'no matches',
    };
  }

  const updatedFrontmatter = buildUpdatedFrontmatter(
    frontmatter,
    walk.primitivesUsed,
    walk.iconsUsed,
    options.primitiveImportBase,
    options.iconImportBase,
  );
  let assembled = assembleAstroFile(updatedFrontmatter, walk.html);

  if (options.prettify) {
    const pretty = await prettifyAstro(assembled);
    if (pretty.ok) {
      assembled = pretty.output;
    } else {
      console.warn(`prettier skipped for ${path.basename(filePath)}: ${pretty.error}`);
    }
  }

  await writeFile(filePath, assembled, 'utf8');

  return {
    filePath,
    changed: true,
    primitivesUsed: walk.primitivesUsed,
    iconsUsed: walk.iconsUsed,
    classSwaps: walk.classSwaps,
    iconSwaps: walk.iconSwaps,
    protection: walk.protection,
  };
}

async function collectAstroFiles(rootDir: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRNAMES.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.astro')) continue;
      if (SKIP_BASENAMES.has(entry.name)) continue;
      out.push(full);
    }
  }

  await walk(rootDir);
  out.sort();
  return out;
}

async function assertDir(dirPath: string, label: string): Promise<void> {
  try {
    const s = await stat(dirPath);
    if (!s.isDirectory()) {
      throw new Error(`${label} is not a directory: ${dirPath}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${label} not found: ${dirPath}`);
    }
    throw err;
  }
}

export { renderSummaryTable };
