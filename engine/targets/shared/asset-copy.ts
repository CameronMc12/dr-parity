/**
 * Copy captured assets from a clone directory into a target's `public/`
 * directory. Pure file operations; identical for every framework target.
 */

import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_FILES = new Set(['index.html', 'manifest.json']);

export interface AssetCopyStats {
  count: number;
  bytes: number;
}

export function dirSizeBytes(dir: string): AssetCopyStats {
  let count = 0;
  let bytes = 0;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else {
        count += 1;
        bytes += st.size;
      }
    }
  }
  return { count, bytes };
}

export function copyAssetsToPublic(cloneDir: string, publicDir: string): AssetCopyStats {
  mkdirSync(publicDir, { recursive: true });
  cpSync(cloneDir, publicDir, {
    recursive: true,
    filter: (src: string) => {
      const rel = relative(cloneDir, src);
      if (rel.length === 0) return true;
      const first = rel.split(/[\\/]/, 1)[0];
      if (SKIP_FILES.has(first)) return false;
      return true;
    },
  });
  return dirSizeBytes(publicDir);
}
