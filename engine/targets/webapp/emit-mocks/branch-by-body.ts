/**
 * Emit an MSW handler snippet for a single endpoint group. If a single
 * response was captured, emit a flat handler. If multiple distinct
 * responses share the endpoint, branch on the request body.
 */

import type { EndpointGroup } from './types';
import type { FixtureRef } from './build-fixtures';

type Branch = {
  key: string;
  importName: string;
  status: number;
};

function uniqueByImport(refs: FixtureRef[]): FixtureRef[] {
  const seen = new Set<string>();
  const out: FixtureRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.importName)) continue;
    seen.add(ref.importName);
    out.push(ref);
  }
  return out;
}

function deriveBranches(refs: FixtureRef[]): Branch[] {
  // Group by request body key; pick the most recent fixture per key.
  const byKey = new Map<string, FixtureRef>();
  for (const ref of refs) {
    byKey.set(ref.requestBodyKey, ref);
  }
  return Array.from(byKey.entries()).map(([key, ref]) => ({
    key,
    importName: ref.importName,
    status: ref.status,
  }));
}

function pickDefault(refs: FixtureRef[]): FixtureRef {
  // Prefer a 2xx response as the default; otherwise the last captured.
  const success = refs.find((r) => r.status >= 200 && r.status < 300);
  return success ?? refs[refs.length - 1];
}

function quoteJson(value: string): string {
  return JSON.stringify(value);
}

export function buildBranchingHandler(
  group: EndpointGroup,
  refs: FixtureRef[],
): { handlerCode: string; imports: string[] } {
  const methodLower = group.method.toLowerCase();
  const handlerPath = group.pathPattern;
  const uniqueRefs = uniqueByImport(refs);
  const imports = uniqueRefs.map((r) => r.importName);

  if (refs.length === 1 || uniqueRefs.length === 1) {
    const only = uniqueRefs[0];
    const code = [
      `  http.${methodLower}(${quoteJson(handlerPath)}, () =>`,
      `    HttpResponse.json(${only.importName} as unknown, { status: ${only.status} }),`,
      `  ),`,
    ].join('\n');
    return { handlerCode: code, imports };
  }

  const branches = deriveBranches(refs);
  const def = pickDefault(refs);

  // GET requests rarely have a meaningful request body. For GETs with
  // multiple distinct responses, fall back to returning the first.
  if (group.method === 'GET' || group.method === 'HEAD') {
    const first = uniqueRefs[0];
    const code = [
      `  http.${methodLower}(${quoteJson(handlerPath)}, () =>`,
      `    HttpResponse.json(${first.importName} as unknown, { status: ${first.status} }),`,
      `  ),`,
    ].join('\n');
    return { handlerCode: code, imports };
  }

  const branchLines: string[] = [];
  for (const branch of branches) {
    branchLines.push(
      `    if (key === ${quoteJson(branch.key)}) return HttpResponse.json(${branch.importName} as unknown, { status: ${branch.status} });`,
    );
  }

  const code = [
    `  http.${methodLower}(${quoteJson(handlerPath)}, async ({ request }) => {`,
    `    const raw = await request.clone().text().catch(() => '');`,
    `    let key = raw;`,
    `    try { key = stableStringify(JSON.parse(raw)); } catch { /* keep raw */ }`,
    ...branchLines,
    `    return HttpResponse.json(${def.importName} as unknown, { status: ${def.status} });`,
    `  }),`,
  ].join('\n');

  return { handlerCode: code, imports };
}
