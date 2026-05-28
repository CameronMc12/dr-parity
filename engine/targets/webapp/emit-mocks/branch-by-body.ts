/**
 * Emit an MSW handler snippet for a single endpoint group. If a single
 * response was captured, emit a flat handler. If multiple distinct
 * responses share the endpoint, branch on the request body.
 *
 * NOTE: this is the COMPILE-TIME exact-match branching for the WEBAPP
 * target's MSW handlers. The REPLAY target's runtime fuzzy-body fallback
 * lives in `engine/targets/webapp/replay/match/*` and is wired into the
 * generated sw.js via `emit-sw.ts` (gated by `profile.fuzzyBodyMatch`).
 * The two paths intentionally do NOT share code: webapp handlers are
 * deterministic per-recording branches; the replay SW is a single fetch
 * interceptor that runs structural similarity at request time.
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

/**
 * Compose the MSW handler URL. The cloned app issues real cross-origin
 * requests (e.g. https://frontdoor-prod-eu-west-1-3.clickup.com/tasks/v1/:id),
 * and MSW relative patterns only match the document origin (localhost). So we
 * register the absolute captured origin whenever one is known. The `:param`
 * path-param syntax works the same way against absolute URLs in MSW 2.x.
 */
export function buildHandlerUrl(origin: string, pathPattern: string): string {
  if (!origin) return pathPattern;
  const normalizedPath = pathPattern.startsWith('/') ? pathPattern : `/${pathPattern}`;
  return `${origin}${normalizedPath}`;
}

export function buildBranchingHandler(
  group: EndpointGroup,
  refs: FixtureRef[],
): { handlerCode: string; imports: string[] } {
  const methodLower = group.method.toLowerCase();
  const handlerPath = buildHandlerUrl(group.origin, group.pathPattern);
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
