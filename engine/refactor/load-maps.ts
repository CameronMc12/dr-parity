import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  DomSwapEntry,
  DomSwapMap,
  NormalisedSwapEntry,
  PrimitiveMap,
} from './types';

async function assertFileExists(filePath: string, label: string): Promise<void> {
  try {
    const s = await stat(filePath);
    if (!s.isFile()) {
      throw new Error(`${label} is not a file: ${filePath}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${label} not found: ${filePath}`);
    }
    throw err;
  }
}

export async function loadPrimitiveMap(filePath: string): Promise<PrimitiveMap> {
  const abs = path.resolve(filePath);
  await assertFileExists(abs, 'primitive-map');
  const raw = await readFile(abs, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse primitive-map JSON at ${abs}: ${(err as Error).message}`);
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('byClass' in parsed) ||
    !('byTag' in parsed)
  ) {
    throw new Error(
      `primitive-map at ${abs} must contain 'byClass' and 'byTag' objects`,
    );
  }

  const obj = parsed as { byClass: unknown; byTag: unknown };
  if (typeof obj.byClass !== 'object' || obj.byClass === null) {
    throw new Error(`primitive-map.byClass must be an object at ${abs}`);
  }
  if (typeof obj.byTag !== 'object' || obj.byTag === null) {
    throw new Error(`primitive-map.byTag must be an object at ${abs}`);
  }

  return parsed as PrimitiveMap;
}

export async function loadIconSwapMap(filePath: string): Promise<DomSwapMap> {
  const abs = path.resolve(filePath);
  await assertFileExists(abs, 'icon-swap-map');
  const raw = await readFile(abs, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse icon-swap-map JSON at ${abs}: ${(err as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`icon-swap-map at ${abs} must be an array`);
  }

  for (const entry of parsed) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as DomSwapEntry).originalOuterHTML !== 'string' ||
      typeof (entry as DomSwapEntry).hash !== 'string' ||
      typeof (entry as DomSwapEntry).pascalName !== 'string'
    ) {
      throw new Error(
        `Each icon-swap-map entry must have originalOuterHTML, hash, pascalName (at ${abs})`,
      );
    }
  }

  return parsed as DomSwapMap;
}

export function normaliseHtmlForCompare(html: string): string {
  let out = html.replace(/\s+/g, ' ').trim();
  out = out.replace(/<([A-Za-z][^\s>/]*)/g, (_m, tag) => `<${String(tag).toLowerCase()}`);
  out = out.replace(/<\/([A-Za-z][^\s>]*)>/g, (_m, tag) => `</${String(tag).toLowerCase()}>`);
  out = out.replace(/\s([A-Za-z][A-Za-z0-9-]*)\s*=/g, (_m, attr) => ` ${String(attr).toLowerCase()}=`);
  out = out.replace(/>\s+</g, '><');
  return out;
}

export function buildNormalisedSwapIndex(map: DomSwapMap): NormalisedSwapEntry[] {
  return map.map((entry) => ({
    ...entry,
    normalisedKey: normaliseHtmlForCompare(entry.originalOuterHTML),
  }));
}
