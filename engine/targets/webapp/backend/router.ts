/**
 * Route an internal-API request through the handler chain, record coverage, and
 * produce the response shape (body + headers). The first handler that returns a
 * non-null result wins and the response is tagged `x-backend: live`. When no
 * handler matches, the router returns an empty-200 (so the bundle does not break)
 * tagged `x-backend: miss` and counts the path as a gap.
 */

import { CoverageLog, type CoverageOutcome } from './coverage';
import { HANDLERS, type RequestCtx } from './handlers';
import type { CapturedTemplates } from './templates-cache';
import type { BackendStore } from './store-types';

export type RoutedResponse = {
  status: number;
  body: string;
  headers: Record<string, string>;
  outcome: CoverageOutcome;
  handler: string | null;
};

const JSON_CT = 'application/json; charset=utf-8';

export function routeRequest(
  ctx: RequestCtx,
  store: BackendStore,
  templates: CapturedTemplates,
  coverage: CoverageLog,
): RoutedResponse {
  for (const handler of HANDLERS) {
    const result = handler(ctx, store, templates);
    if (!result) continue;
    coverage.record({
      method: ctx.method,
      path: ctx.pathname,
      handler: result.handler,
      outcome: 'live',
    });
    return {
      status: 200,
      body: JSON.stringify(result.body),
      headers: { 'content-type': JSON_CT, 'x-backend': 'live', 'x-backend-handler': result.handler },
      outcome: 'live',
      handler: result.handler,
    };
  }

  // No handler: empty-200 keeps the bundle alive; counted as a MISS gap.
  coverage.record({ method: ctx.method, path: ctx.pathname, handler: null, outcome: 'miss' });
  return {
    status: 200,
    body: '{}',
    headers: { 'content-type': JSON_CT, 'x-backend': 'miss' },
    outcome: 'miss',
    handler: null,
  };
}
