/**
 * Seed manifest — maps stable fixture keys to created ClickUp ids. The crawler
 * reads this to build deterministic seed-scoped routes.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SEED_MARKER } from './types.js';

export const MANIFEST_PATH = 'docs/research/clickup-parity/seed/seed-manifest.json';

export interface SeedManifest {
  marker: string;
  teamId: string;
  generatedAt: string;
  spaceId: string;
  /** fixture key -> ClickUp id, for spaces / folders / lists / tasks / docs. */
  ids: Record<string, string>;
}

export function emptyManifest(teamId: string): SeedManifest {
  return {
    marker: SEED_MARKER,
    teamId,
    generatedAt: new Date().toISOString(),
    spaceId: '',
    ids: {},
  };
}

export async function loadManifest(path: string): Promise<SeedManifest | null> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as SeedManifest;
  } catch {
    return null;
  }
}

export async function writeManifest(path: string, manifest: SeedManifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
