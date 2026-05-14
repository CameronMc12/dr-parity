/**
 * File copier + manifest writer for the clone output tree.
 */

import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CloneManifest, UrlMap } from './types';

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function copyMappedFiles(args: {
  cloneRoot: string;
  urlMap: UrlMap;
}): void {
  for (const entry of args.urlMap.values()) {
    if (entry.bucket === 'document') continue;
    if (!entry.sourceFile) continue;
    if (!existsSync(entry.sourceFile)) continue;
    const dest = join(args.cloneRoot, entry.cloneRelPath);
    ensureDir(dirname(dest));
    copyFileSync(entry.sourceFile, dest);
  }
}

export function writeText(filePath: string, content: string): number {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

export function writeManifest(cloneRoot: string, manifest: CloneManifest): void {
  writeText(join(cloneRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
}
