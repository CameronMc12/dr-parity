/**
 * Input validation for extract-tokens.
 *
 * Reads + parses the JSON analysis artifacts emitted by extract-css and
 * fails fast with explicit, contextual errors on any missing or malformed input.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BreakpointEntry,
  ColorUsageEntry,
  CssRule,
  SpacingClusterEntry,
  TypographyClusterEntry,
} from '../analyze/css/types';
import type { AnalysisBundle } from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const REQUIRED_FILES = [
  'color-usage.json',
  'typography.json',
  'spacing.json',
  'breakpoints.json',
  'css-rules.json',
] as const;

export function assertAnalysisDir(analysisDir: string): void {
  if (!existsSync(analysisDir)) {
    throw new ValidationError(
      `Analysis directory does not exist: ${analysisDir}`,
    );
  }
  const stat = statSync(analysisDir);
  if (!stat.isDirectory()) {
    throw new ValidationError(
      `Analysis path is not a directory: ${analysisDir}`,
    );
  }
  for (const file of REQUIRED_FILES) {
    const path = join(analysisDir, file);
    if (!existsSync(path)) {
      throw new ValidationError(`Missing required analysis file: ${path}`);
    }
  }
}

export function loadAnalysis(analysisDir: string): AnalysisBundle {
  const colors = parseJsonFile<ColorUsageEntry[]>(
    join(analysisDir, 'color-usage.json'),
    'color-usage.json',
    (v) =>
      Array.isArray(v) &&
      v.every(
        (e) =>
          isObj(e) &&
          typeof e.value === 'string' &&
          typeof e.count === 'number' &&
          Array.isArray(e.contexts) &&
          typeof e.exampleSelector === 'string',
      ),
  );

  const typography = parseJsonFile<TypographyClusterEntry[]>(
    join(analysisDir, 'typography.json'),
    'typography.json',
    (v) =>
      Array.isArray(v) &&
      v.every(
        (e) =>
          isObj(e) &&
          typeof e.property === 'string' &&
          typeof e.value === 'string' &&
          typeof e.count === 'number' &&
          Array.isArray(e.selectors),
      ),
  );

  const spacing = parseJsonFile<SpacingClusterEntry[]>(
    join(analysisDir, 'spacing.json'),
    'spacing.json',
    (v) =>
      Array.isArray(v) &&
      v.every(
        (e) =>
          isObj(e) &&
          typeof e.value === 'string' &&
          typeof e.count === 'number' &&
          Array.isArray(e.contexts) &&
          Array.isArray(e.selectors),
      ),
  );

  const breakpoints = parseJsonFile<BreakpointEntry[]>(
    join(analysisDir, 'breakpoints.json'),
    'breakpoints.json',
    (v) =>
      Array.isArray(v) &&
      v.every(
        (e) =>
          isObj(e) &&
          (e.feature === 'min-width' || e.feature === 'max-width') &&
          typeof e.value === 'string' &&
          typeof e.count === 'number',
      ),
  );

  const rules = parseJsonFile<CssRule[]>(
    join(analysisDir, 'css-rules.json'),
    'css-rules.json',
    (v) =>
      Array.isArray(v) &&
      v.every(
        (r) =>
          isObj(r) &&
          typeof r.selector === 'string' &&
          Array.isArray(r.declarations),
      ),
  );

  return { colors, typography, spacing, breakpoints, rules };
}

function parseJsonFile<T>(
  path: string,
  label: string,
  predicate: (v: unknown) => boolean,
): T {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new ValidationError(
      `Failed to read ${label} at ${path}: ${(err as Error).message}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(
      `Failed to parse ${label} as JSON (${path}): ${(err as Error).message}`,
    );
  }
  if (!predicate(parsed)) {
    throw new ValidationError(
      `Schema mismatch for ${label}: structure does not match expected shape.`,
    );
  }
  return parsed as T;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
