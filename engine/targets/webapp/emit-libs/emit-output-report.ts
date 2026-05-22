/**
 * Write OUTPUT.md inside the scaffolded clone. The report is the single
 * source of truth for what was auto-wired vs what needs manual attention:
 * - Auto-wired wrapper-component libs (with version + wrapper path)
 * - Attribute-rewrite libs (with the human note explaining why)
 * - Manual-only detected libs (the swapInstructions text)
 * - Unknown patterns the scanner couldn't classify
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { DetectedLib, LibDetectionResult } from '../detect-libs/types';

import type { DepMergeResult } from './types';

function section(title: string, lines: string[]): string {
  return `## ${title}\n\n${lines.length === 0 ? '_None._' : lines.join('\n')}\n`;
}

function bullet(text: string): string {
  return `- ${text}`;
}

function listAutoWired(detected: DetectedLib[]): string[] {
  const lines: string[] = [];
  for (const lib of detected) {
    if (lib.signature.swapStrategy !== 'wrapper-component') continue;
    const eq = lib.signature.reactEquivalent;
    lines.push(
      bullet(
        `**${lib.signature.displayName}** → \`${eq.npmPackage}@${eq.version}\` (wrapper: \`${eq.wrapperPath}\`, occurrences: ${lib.occurrences})`,
      ),
    );
  }
  return lines;
}

function listAttributeRewrite(detected: DetectedLib[]): string[] {
  const lines: string[] = [];
  for (const lib of detected) {
    if (lib.signature.swapStrategy !== 'attribute-rewrite') continue;
    lines.push(
      bullet(`**${lib.signature.displayName}** (occurrences: ${lib.occurrences})`),
    );
    if (lib.signature.swapInstructions) {
      lines.push(`  - ${lib.signature.swapInstructions}`);
    }
    if (lib.evidence.length > 0) {
      lines.push(`  - Evidence: \`${lib.evidence.join('`, `')}\``);
    }
  }
  return lines;
}

function listManualOnly(manualOnly: DetectedLib[]): string[] {
  const lines: string[] = [];
  for (const lib of manualOnly) {
    const eq = lib.signature.reactEquivalent;
    lines.push(
      bullet(
        `**${lib.signature.displayName}** → suggested \`${eq.npmPackage}@${eq.version}\` (occurrences: ${lib.occurrences})`,
      ),
    );
    if (lib.signature.swapInstructions) {
      lines.push(`  - ${lib.signature.swapInstructions}`);
    }
    if (lib.evidence.length > 0) {
      lines.push(`  - Evidence: \`${lib.evidence.join('`, `')}\``);
    }
  }
  return lines;
}

function listUnknown(detection: LibDetectionResult): string[] {
  return detection.unknown.map((u) =>
    bullet(`\`${u.evidence}\` — ${u.whyFlagged}`),
  );
}

function listInstalledDeps(deps: DepMergeResult): string[] {
  const lines: string[] = [];
  if (deps.added.length > 0) {
    lines.push('**Added:**');
    for (const a of deps.added) lines.push(bullet(`\`${a}\``));
  }
  if (deps.skipped.length > 0) {
    lines.push('');
    lines.push('**Skipped (already at compatible version):**');
    for (const s of deps.skipped) lines.push(bullet(`\`${s}\``));
  }
  return lines;
}

export async function writeOutputReport(
  outDir: string,
  detection: LibDetectionResult,
  deps: DepMergeResult,
): Promise<string> {
  const reportPath = join(outDir, 'OUTPUT.md');
  const detectedAttrRewrite = detection.detected.filter(
    (d) => d.signature.swapStrategy === 'attribute-rewrite',
  );

  const body = [
    '# Dr Parity — Library Swap Report',
    '',
    'Phase 6 detected the following third-party UI libraries in the captured DOM and took the actions listed below. Detection is signature-based and only covers libraries with unique DOM markers. Anything CSS-only or opaque is flagged for manual review.',
    '',
    section('Auto-wired (wrapper-component)', listAutoWired(detection.detected)),
    section('Attribute-rewrite (needs manual component wiring)', listAttributeRewrite(detectedAttrRewrite)),
    section('Manual-only (detected but no auto-swap available)', listManualOnly(detection.manualOnly)),
    section('Unknown patterns (recurring data-attrs we could not classify)', listUnknown(detection)),
    section('Dependency changes (package.json)', listInstalledDeps(deps)),
  ].join('\n');

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, body, 'utf8');
  return reportPath;
}
