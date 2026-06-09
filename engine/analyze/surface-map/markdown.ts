/**
 * Human-readable markdown emitters for the surface map.
 */

import type {
  ActionGroup,
  EndpointsByService,
  RoutesResult,
  ShapeValue,
  WakaruResult,
} from './types.js';
import { countEndpoints } from './endpoints.js';
import { countActions } from './actions.js';

function shapePreview(shape: ShapeValue | null): string {
  if (shape == null) return '—';
  const json = JSON.stringify(shape);
  return json.length > 120 ? `${json.slice(0, 117)}…` : json;
}

export function endpointsMarkdown(grouped: EndpointsByService): string {
  const lines: string[] = ['# ClickUp API Endpoints (Surface Map)', ''];
  lines.push(`Total distinct endpoints: **${countEndpoints(grouped)}** across **${Object.keys(grouped).length}** services.`, '');
  const services = Object.keys(grouped).sort();
  for (const service of services) {
    const list = grouped[service];
    const total = list.reduce((n, e) => n + e.count, 0);
    lines.push(`## ${service} (${list.length} endpoints, ${total} calls)`, '');
    lines.push('| Method | Path Template | Count | Req Shape | Resp Shape |');
    lines.push('|---|---|---:|---|---|');
    for (const e of list) {
      lines.push(
        `| ${e.method} | \`${e.pathTemplate}\` | ${e.count} | ${shapePreview(e.sampleRequestBodyShape)} | ${shapePreview(e.sampleResponseBodyShape)} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function routesMarkdown(routes: RoutesResult): string {
  const lines: string[] = ['# ClickUp Routes (Surface Map)', ''];
  lines.push(`Route definitions from bundles: **${routes.routeDefinitions.length}**`);
  lines.push(`Observed navigation patterns: **${routes.observedRoutes.length}**`, '');

  lines.push('## Route Definitions (Angular router, from bundles)', '');
  lines.push('| Path | loadChildren | redirectTo | component | source |');
  lines.push('|---|---|---|---|---|');
  for (const r of routes.routeDefinitions) {
    lines.push(
      `| \`${r.path || '(empty)'}\` | ${r.loadChildren ?? ''} | ${r.redirectTo ?? ''} | ${r.component ?? ''} | ${r.source} |`,
    );
  }
  lines.push('');

  lines.push('## Observed Navigation (from network logs)', '');
  lines.push('| Pattern | Count | Examples |');
  lines.push('|---|---:|---|');
  for (const o of routes.observedRoutes) {
    lines.push(`| \`${o.pattern}\` | ${o.count} | ${o.examples.map((e) => `\`${e}\``).join(', ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export function actionsMarkdown(groups: ActionGroup[]): string {
  const lines: string[] = ['# ClickUp NgRx Action Types (Surface Map)', ''];
  lines.push(`Total distinct actions: **${countActions(groups)}** across **${groups.length}** namespaces.`, '');
  for (const g of groups) {
    lines.push(`## [${g.namespace}] (${g.count})`, '');
    for (const a of g.actions) {
      lines.push(`- \`${a}\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function indexMarkdown(args: {
  endpoints: EndpointsByService;
  routes: RoutesResult;
  actions: ActionGroup[];
  wakaru: WakaruResult[];
  jsonlFileCount: number;
  bundleCount: number;
  caveats: string[];
}): string {
  const { endpoints, routes, actions, wakaru, jsonlFileCount, bundleCount, caveats } = args;
  const lines: string[] = ['# ClickUp Static Surface Map — INDEX', ''];
  lines.push('Phase 1 definitive crawler manifest, derived entirely from on-disk data.', '');

  lines.push('## Inputs', '');
  lines.push(`- Network logs parsed: **${jsonlFileCount}** \`network.jsonl\` files`);
  lines.push(`- Bundle chunks scanned: **${bundleCount}** \`.js\` files`, '');

  lines.push('## Endpoints', '');
  lines.push(`Total distinct: **${countEndpoints(endpoints)}** across **${Object.keys(endpoints).length}** services.`, '');
  lines.push('| Service | Endpoints |');
  lines.push('|---|---:|');
  for (const svc of Object.keys(endpoints).sort()) {
    lines.push(`| ${svc} | ${endpoints[svc].length} |`);
  }
  lines.push('', 'See `endpoints.json` / `endpoints.md`.', '');

  lines.push('## Routes', '');
  lines.push(`- Route definitions (bundles): **${routes.routeDefinitions.length}**`);
  lines.push(`- Observed navigation patterns: **${routes.observedRoutes.length}**`);
  lines.push('', 'See `routes.json` / `routes.md`.', '');

  lines.push('## Actions', '');
  lines.push(`Total distinct NgRx actions: **${countActions(actions)}** across **${actions.length}** namespaces.`);
  lines.push('', 'Top namespaces:', '');
  for (const g of actions.slice(0, 12)) {
    lines.push(`- \`[${g.namespace}]\` — ${g.count}`);
  }
  lines.push('', 'See `actions.json` / `actions.md`.', '');

  lines.push('## Wakaru Unpacking', '');
  if (wakaru.length === 0) {
    lines.push('No chunks unpacked.');
  } else {
    lines.push('| Chunk | Status | Reason | Note |');
    lines.push('|---|---|---|---|');
    for (const w of wakaru) {
      lines.push(`| ${w.chunk} | ${w.status} | ${w.reason} | ${w.note ?? ''} |`);
    }
  }
  lines.push('', 'Unpacked output in `wakaru/`.', '');

  lines.push('## Caveats & Gaps', '');
  for (const c of caveats) lines.push(`- ${c}`);
  lines.push('');
  return lines.join('\n');
}
