/**
 * Group crawler states by route path, identify base states, and classify
 * 1-hop neighbours as overlays (modal/dropdown/...) or alternate bases.
 */

import type { CrawlGraph, StateEdge, StateNode } from '../crawler/types';
import { classifyToggle } from './classify-toggle';
import { detectDismissStrategy } from './detect-dismiss';
import { diffStates } from './dom-diff';
import type {
  InferenceResult,
  RouteGroup,
  StateGroup,
  StateToggle,
} from './types';

function routePathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return '/';
  }
}

function groupNodesByRoute(nodes: StateNode[]): Map<string, StateNode[]> {
  const byRoute = new Map<string, StateNode[]>();
  for (const node of nodes) {
    const route = routePathOf(node.url);
    const list = byRoute.get(route) ?? [];
    list.push(node);
    byRoute.set(route, list);
  }
  return byRoute;
}

function pickBaseState(nodes: StateNode[]): StateNode {
  return [...nodes].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.capturedAt.localeCompare(b.capturedAt);
  })[0];
}

function findIncomingEdge(
  edges: StateEdge[],
  toStateId: string,
  fromStateId: string,
): StateEdge | undefined {
  return edges.find((e) => e.toStateId === toStateId && e.fromStateId === fromStateId);
}

async function buildToggle(
  graph: CrawlGraph,
  baseId: string,
  targetNode: StateNode,
  readDom: (id: string) => Promise<string>,
): Promise<StateToggle | { kind: 'inline-change' } | null> {
  const baseDom = await readDom(baseId);
  const targetDom = await readDom(targetNode.id);
  const diff = diffStates(baseDom, targetDom);

  if (diff.classification === 'inline-change') {
    return { kind: 'inline-change' };
  }
  if (diff.classification !== 'overlay') return null;
  if (diff.added.length === 0) return null;

  const edge = findIncomingEdge(graph.edges, targetNode.id, baseId);
  if (!edge) return null;

  const kind = classifyToggle(diff, edge);
  const dismiss = detectDismissStrategy(
    targetNode.id,
    diff.added[0].outerHTML,
    graph.edges,
  );

  return {
    toggleStateId: targetNode.id,
    triggerSelector: edge.interaction.selector,
    triggerLabel: edge.interaction.selectorLabel,
    dismissStrategy: dismiss.strategy,
    closeButtonSelector: dismiss.closeButtonSelector,
    kind,
    appearedRoot: diff.added[0],
    appearedSelectorPath: `body > ${diff.added[0].tag}`,
  };
}

export async function inferStateGroups(
  graph: CrawlGraph,
  readDom: (id: string) => Promise<string>,
): Promise<InferenceResult> {
  const byRoute = groupNodesByRoute(graph.nodes);
  const routes: RouteGroup[] = [];
  const unmatchedStates: string[] = [];
  const warnings: string[] = [];

  for (const [routePath, nodes] of byRoute) {
    if (nodes.length === 0) continue;
    const baseNode = pickBaseState(nodes);

    const oneHopNeighbours = graph.edges
      .filter((e) => e.fromStateId === baseNode.id)
      .map((e) => nodes.find((n) => n.id === e.toStateId))
      .filter((n): n is StateNode => Boolean(n) && n!.id !== baseNode.id);

    const toggles: StateToggle[] = [];
    const alternateBases: StateGroup[] = [];

    for (const neighbour of oneHopNeighbours) {
      const result = await buildToggle(graph, baseNode.id, neighbour, readDom);
      if (!result) {
        unmatchedStates.push(neighbour.id);
        continue;
      }
      if ('kind' in result && result.kind === 'inline-change') {
        alternateBases.push({
          baseStateId: neighbour.id,
          routePath,
          toggles: [],
        });
        continue;
      }
      toggles.push(result as StateToggle);
    }

    const baseStateGroup: StateGroup = {
      baseStateId: baseNode.id,
      routePath,
      toggles,
    };

    routes.push({
      routePath,
      baseStateGroup,
      alternateBases: alternateBases.length > 0 ? alternateBases : undefined,
    });

    if (toggles.some((t) => t.kind === 'unknown')) {
      warnings.push(`Route ${routePath}: ${toggles.filter((t) => t.kind === 'unknown').length} unclassified overlays`);
    }
  }

  return { routes, unmatchedStates, warnings };
}
