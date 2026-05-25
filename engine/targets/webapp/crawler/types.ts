/**
 * Phase 2 crawler types.
 *
 * Nodes = unique DOM states (deduped by `domHash`).
 * Edges = interactions that transition between states.
 */

export type InteractionKind =
  | 'click'
  | 'right-click'
  | 'hover'
  | 'navigate'
  | 'keyboard';

export type Interaction = {
  kind: InteractionKind;
  selector: string;
  selectorLabel: string;
  elementTag: string;
  keyCombo?: string;
  /**
   * Additive. Set when the resulting state is an overlay (modal/dropdown/menu)
   * that the crawler waited to fully populate before snapshotting. Lets emit
   * distinguish a populated overlay edge from a plain inline change.
   */
  opensOverlay?: boolean;
  /**
   * Additive. Set when the interaction opened a new tab / popup window that the
   * crawler captured as its own state.
   */
  opensPopup?: boolean;
};

/**
 * Where a state was reached from. Additive — older consumers ignore it.
 *  - 'route'   : a distinct navigated route base capture
 *  - 'overlay' : a modal/menu/popover opened on top of a route
 *  - 'popup'   : a new tab / popup window opened by an interaction
 *  - 'scroll'  : a content-population (scroll/search) variant of a route
 */
export type StateSourceKind = 'route' | 'overlay' | 'popup' | 'scroll';

export type StateNode = {
  id: string;
  url: string;
  domHash: string;
  title: string;
  screenshotPath: string;
  domPath: string;
  capturedAt: string;
  depth: number;
  /**
   * Additive. Path to the ARIA accessibility snapshot captured alongside
   * dom.html (`aria.json`). Absent on graphs produced before this field existed.
   */
  ariaPath?: string;
  /**
   * Additive. Composite canonical state key = normalised route + a sorted
   * signature of the visible overlay/tab/drawer/panel structure, combined with
   * the normalised DOM hash. Used as the dedup key so genuinely-different states
   * on the same route (different modal/tab) are NOT collapsed.
   */
  canonicalKey?: string;
  /**
   * Additive. How this state was reached. Absent on older graphs.
   */
  sourceKind?: StateSourceKind;
};

export type StateEdge = {
  fromStateId: string;
  toStateId: string;
  interaction: Interaction;
  capturedAt: string;
};

/**
 * Bump when the artifact shape changes in a way consumers must branch on.
 * Additive field — consumers that do not read it keep working.
 */
export const CRAWL_GRAPH_SCHEMA_VERSION = 2;

export type CrawlGraph = {
  /**
   * Additive. Artifact schema version. Absent => treat as version 1 (the
   * pre-versioning shape) for backward compatibility.
   */
  schemaVersion?: number;
  nodes: StateNode[];
  edges: StateEdge[];
  startUrl: string;
  userAgent: string;
  viewport: string;
};

export type CrawlSummary = {
  stateCount: number;
  edgeCount: number;
  durationMs: number;
  blocked: number;
  errors: number;
  signaturesFound: string[];
  finishedAt: string;
  reachedLimit:
    | 'max-states'
    | 'max-time'
    | 'queue-empty'
    | 'fatal-error'
    | 'dry-run';
};

export type CrawlOptions = {
  startUrl: string;
  outDir: string;
  maxDepth: number;
  maxTime: number;
  maxStates: number;
  userDataDir: string;
  viewport: { width: number; height: number };
  dryRun: boolean;
  aggressive: boolean;
  extraBlocklist: string[];
  /**
   * Replay mode. When true, JS/mjs/cjs response bodies are captured FULL
   * (uncapped) instead of stripped to size-only, so the replay target can boot
   * the original JS bundle offline. Source maps (.map) stay stripped. Default
   * false keeps the lean behaviour the react/static targets rely on.
   */
  captureJs: boolean;
};

export type RecorderHandles = {
  closeAll: () => Promise<void>;
};

export type QueueItem = {
  url: string;
  depth: number;
  viaEdge: Omit<StateEdge, 'toStateId'> | null;
  /**
   * Additive. Higher = explored sooner. Unexplored routes get a higher
   * priority than re-derivable / revisit items. Defaults to 0 when absent.
   */
  priority?: number;
};
