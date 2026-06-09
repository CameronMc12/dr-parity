/**
 * Webapp-target types. Re-exports the shared IR types and adds webapp-
 * specific extensions for state inference (Phase 3), MSW handlers (Phase 4),
 * and websocket stubs (Phase 5).
 *
 * Phase 1: minimal shape, placeholders only. Later phases extend without
 * breaking callers.
 */

export type {
  ComponentDef,
  ComponentRole,
  ExtractedHead,
  SliceResult,
} from '../shared/types';

import type { ComponentDef } from '../shared/types';

/**
 * A component definition after HTML-to-JSX conversion. `stateful` /
 * `stateGroup` are placeholders the state inference pass (Phase 3) will
 * populate to mark components that toggle between captured DOM snapshots.
 */
export interface WebappComponentDef extends ComponentDef {
  tsx: string;
  stateful?: boolean;
  stateGroup?: string;
  childImports?: string[];
}

export interface WebappBuildOptions {
  /**
   * Path to a static HTML clone (input). Optional in crawl-only mode: when
   * absent, `crawlDir` MUST be set and the build derives the document head +
   * documentUrl from the crawl's root-state DOM and graph.json.
   */
  cloneDir?: string;
  outDir: string;
  name: string;
  force?: boolean;
  primitives?: unknown;
  /**
   * Routes to emit. Each route maps to a React Router path served from the
   * same SPA shell. Defaults to `['/']` when omitted.
   */
  routes?: string[];
  /**
   * Phase 3 input. When set, build switches to the stateful pipeline:
   * loads the crawl graph at this path, infers state groups, and emits
   * per-route stateful page components. Phase 1's single-page flat
   * emission is bypassed in that mode.
   */
  crawlDir?: string;
}

export interface WebappBuildSummary {
  outDir: string;
  componentsEmitted: number;
  pagesEmitted: number;
  assetCount: number;
  assetBytes: number;
  /** Phase 4: distinct endpoint groups emitted into `src/mocks/handlers.ts`. */
  endpointsEmitted: number;
  /** Phase 4: fixture JSON files written under `src/fixtures/`. */
  fixturesEmitted: number;
  /** Phase 5: websocket connection groups replayed via `src/mocks/socket.ts`. */
  wsConnectionsEmitted: number;
}

/**
 * Phase 3 placeholder. Crawler + state inference fill this in to wire
 * captured base/target DOM snapshots into a single stateful component
 * (e.g. closed/open dropdown, closed/open modal).
 */
export interface WebappStatePair {
  baseStateId: string;
  targetStateId: string;
  triggerSelector: string;
  kind: 'modal' | 'dropdown' | 'popover' | 'unknown';
}
