/**
 * Emit one fixture file per unique response body within an endpoint group.
 * Returns the descriptors plus a map from record-index to fixture path so
 * the handler builder can wire branching responses to the right fixture.
 */

import type { EndpointGroup, FixtureFile } from './types';

export type FixtureRef = {
  recordIndex: number;
  relativePath: string;
  importName: string;
  status: number;
  requestBodyKey: string;
};

export type BuiltFixtures = {
  files: FixtureFile[];
  refs: FixtureRef[];
};

export function slugifyPath(pathPattern: string): string {
  return pathPattern
    .toLowerCase()
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/:/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function fixtureImportName(method: string, pathPattern: string, index: number): string {
  const slug = slugifyPath(pathPattern).replace(/-/g, '_');
  const safe = slug.length > 0 ? slug : 'root';
  return `fixture_${method.toLowerCase()}_${safe}_${index}`;
}

function tryParseJson(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') +
    '}'
  );
}

export function normalizeRequestBody(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  const parsed = tryParseJson(raw);
  if (parsed !== undefined) return stableStringify(parsed);
  return raw;
}

function normalizeResponseBody(raw: string | null | undefined): {
  content: string;
  isJson: boolean;
} {
  if (raw === null || raw === undefined || raw === '') {
    return { content: 'null', isJson: true };
  }
  const parsed = tryParseJson(raw);
  if (parsed !== undefined) {
    return { content: JSON.stringify(parsed, null, 2), isJson: true };
  }
  return { content: JSON.stringify({ raw }, null, 2), isJson: false };
}

export function buildFixtures(group: EndpointGroup): BuiltFixtures {
  const files: FixtureFile[] = [];
  const refs: FixtureRef[] = [];

  // De-duplicate by response body content + status.
  const seen = new Map<string, { relativePath: string; importName: string }>();
  let nextIndex = 0;

  const slug = slugifyPath(group.pathPattern) || 'root';
  const methodLower = group.method.toLowerCase();

  group.records.forEach((rec, recordIndex) => {
    const { content } = normalizeResponseBody(rec.responseBody);
    const dedupeKey = `${rec.responseStatus}::${content}`;

    let existing = seen.get(dedupeKey);
    if (!existing) {
      const index = nextIndex++;
      const relativePath = `src/fixtures/${methodLower}-${slug}-${index}.json`;
      const importName = fixtureImportName(group.method, group.pathPattern, index);
      files.push({ relativePath, content: content + '\n' });
      existing = { relativePath, importName };
      seen.set(dedupeKey, existing);
    }

    refs.push({
      recordIndex,
      relativePath: existing.relativePath,
      importName: existing.importName,
      status: rec.responseStatus,
      requestBodyKey: normalizeRequestBody(rec.requestBody),
    });
  });

  return { files, refs };
}
