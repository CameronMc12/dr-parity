/**
 * Merge wrapper-component library deps into the scaffolded clone's
 * package.json. Idempotent: existing entries are kept if they're at a
 * compatible-or-higher semver. We don't do a real semver resolve — just
 * compare numeric major.minor.patch when both sides parse cleanly.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import type { DetectedLib } from '../detect-libs/types';

import type { DepMergeResult } from './types';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

const PEER_CSS_DEPS: Record<string, Record<string, string>> = {
  // react-slick needs slick-carousel installed for its stylesheet.
  'slick-carousel': { 'slick-carousel': '^1.8.1' },
};

function parseSemver(spec: string): [number, number, number] | null {
  const m = spec.replace(/^[\^~>=<\s]+/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isHigherOrEqual(existing: string, incoming: string): boolean {
  const a = parseSemver(existing);
  const b = parseSemver(incoming);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

export async function mergeDependencies(
  pkgJsonPath: string,
  detected: DetectedLib[],
): Promise<DepMergeResult> {
  if (!existsSync(pkgJsonPath)) {
    return { added: [], skipped: [] };
  }
  const raw = readFileSync(pkgJsonPath, 'utf8');
  const pkg = JSON.parse(raw) as PackageJson;
  pkg.dependencies = pkg.dependencies ?? {};

  const added: string[] = [];
  const skipped: string[] = [];
  const queue: Array<{ name: string; version: string; sourceId: string }> = [];

  for (const lib of detected) {
    if (lib.signature.swapStrategy !== 'wrapper-component') continue;
    queue.push({
      name: lib.signature.reactEquivalent.npmPackage,
      version: lib.signature.reactEquivalent.version,
      sourceId: lib.signature.id,
    });
    const peers = PEER_CSS_DEPS[lib.signature.id];
    if (peers) {
      for (const [n, v] of Object.entries(peers)) {
        queue.push({ name: n, version: v, sourceId: lib.signature.id });
      }
    }
    // dnd-kit also needs sortable companion package.
    if (lib.signature.id === 'dnd-kit') {
      queue.push({
        name: '@dnd-kit/sortable',
        version: '^8.0.0',
        sourceId: 'dnd-kit',
      });
    }
  }

  for (const item of queue) {
    const existing = pkg.dependencies[item.name];
    if (existing) {
      if (isHigherOrEqual(existing, item.version)) {
        skipped.push(`${item.name}@${existing}`);
        continue;
      }
    }
    pkg.dependencies[item.name] = item.version;
    added.push(`${item.name}@${item.version}`);
  }

  writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  return { added, skipped };
}
