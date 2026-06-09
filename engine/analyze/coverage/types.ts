/**
 * Shared types for the crawl coverage-report tool. Coverage compares a crawl
 * run against the Phase 1 Static Surface Map and reports what was exercised
 * and, explicitly, what was MISSED.
 */

import type { EndpointEntry } from '../surface-map/types.js';

/** The surface-map endpoints.json is grouped by service. */
export type SurfaceEndpoints = Record<string, EndpointEntry[]>;

export type SurfaceRoute = {
  pattern: string;
  examples: string[];
  count: number;
};

export type SurfaceRoutes = {
  routeDefinitions: unknown[];
  observedRoutes: SurfaceRoute[];
};

export type EndpointStatus = {
  service: string;
  method: string;
  pathTemplate: string;
  surfaceCount: number;
  hit: boolean;
  runCount: number;
};

export type ServiceRollup = {
  service: string;
  total: number;
  hit: number;
  pct: number;
};

export type NewEndpoint = {
  method: string;
  pathTemplate: string;
  runCount: number;
  exampleUrl: string;
};

export type EndpointCoverage = {
  overall: { total: number; hit: number; pct: number };
  byService: ServiceRollup[];
  endpoints: EndpointStatus[];
  missed: EndpointStatus[];
  newDiscoveries: NewEndpoint[];
};

export type RouteStatus = {
  pattern: string;
  surfaceCount: number;
  hit: boolean;
  source: 'graph' | 'document' | 'both' | 'none';
};

export type RouteCoverage = {
  overall: { total: number; hit: number; pct: number };
  routes: RouteStatus[];
  missed: RouteStatus[];
};

/** The five interaction classes the harness is expected to fire. */
export const INTERACTION_CLASSES = [
  'click',
  'contextmenu',
  'hover',
  'keyboard',
  'dnd',
] as const;

export type InteractionClass = (typeof INTERACTION_CLASSES)[number];

export type InteractionCoverage = {
  /** Raw label -> count (e.g. `hover-row`, `kbd-cmdk`, `route`). */
  byLabel: Record<string, number>;
  /** Normalised class -> count. */
  byClass: Record<InteractionClass, number>;
  /** Classes with zero captures — a coverage hole. */
  emptyClasses: InteractionClass[];
  totalStates: number;
  /** Labels that could not be mapped to a known class. */
  unclassified: Record<string, number>;
};

export type CoverageReport = {
  runDir: string;
  generatedAt: string;
  missingInputs: string[];
  endpoint: EndpointCoverage;
  route: RouteCoverage;
  interaction: InteractionCoverage;
};
