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
  /**
   * Additive, opt-in. When set, Chromium launches with
   * `--proxy-server=<host:port>` and `--disable-quic` so all traffic routes
   * through an external transport-capture proxy (e.g. mitmdump). Absent =>
   * default behaviour unchanged (no proxy). Requires the proxy's CA to be
   * trusted by the persistent profile for TLS interception to succeed.
   */
  proxyServer?: string;
  /**
   * Additive, opt-in. When set, the crawler explicitly enforces service-worker
   * bypass on the capture path (context `serviceWorkers: 'block'` plus the
   * per-page CDP `Network.setBypassServiceWorker`). Absent leaves the existing
   * default behaviour untouched.
   */
  bypassServiceWorker?: boolean;
  /**
   * Additive, opt-in. When true, the persistent Chrome profile launches
   * headless. Absent / false => the profile launches headed (the prior default),
   * so behaviour is unchanged unless this flag is explicitly set.
   */
  headless?: boolean;
  /**
   * Additive, opt-in. Overrides the per-route interaction budget (max clicks /
   * right-clicks the crawler spends inside a single route before moving on).
   * Absent => the built-in default is used, so behaviour is identical to before
   * this field existed. Higher values yield deeper per-route coverage (more
   * modal/overlay states) at the cost of more time + states per route.
   */
  routeBudget?: number;
  /**
   * Additive, opt-in. Extra settle delay (ms) applied AFTER the existing
   * load/idle/steady-state wait but BEFORE each route's base DOM snapshot.
   * Gives data-driven views (ClickUp task grids: List/Table/Board) time for the
   * backend rows to render into the DOM before capture. Absent / 0 => behaviour
   * is byte-identical to before this field existed (no extra wait).
   */
  settleMs?: number;
  /**
   * Additive, opt-in. When true, a bounded scroll pass runs BEFORE each route's
   * base DOM snapshot to trigger lazy/virtualized row rendering and lazy images
   * (then scrolls back to the top). Absent / false => no pre-capture scroll, so
   * behaviour is byte-identical to before this field existed.
   */
  scrollCapture?: boolean;
  /**
   * Additive, opt-in. App profile that may supply route discoverers run once
   * at crawler init. Absent / empty discoverers => behaviour is byte-identical
   * to before profiles existed (the DOM-only frontier).
   */
  profile?: WebappProfileLike;
  /**
   * Additive, opt-in. L5 keyboard harness (command center Cmd/Ctrl+K, slash
   * menu, curated safe hotkey sweep). Default ON in exhaustive mode; set false
   * to disable. Runs AFTER click / right-click discovery per route.
   */
  keyboardHarness?: boolean;
  /**
   * Additive, opt-in. Drag-and-drop harness — a few representative reversible
   * drags when a dnd-kit / react-beautiful-dnd / native-draggable signature is
   * present. Default ON in exhaustive mode; set false to disable.
   */
  dndHarness?: boolean;
  /**
   * Additive, opt-in. L4 hover-as-state harness (tooltips / popovers triggered
   * by hover). Default ON in exhaustive mode; set false to disable.
   */
  hoverHarness?: boolean;
  /**
   * Additive, opt-in. Inter-interaction delay (ms) for the extended harnesses to
   * stay under rate limits. Absent => env DRPARITY_INTERACTION_DELAY_MS, then a
   * 400-800ms jittered default.
   */
  interactionDelayMs?: number;
  /**
   * Additive, opt-in (FOCUSED-CRAWL). When true, the profile route-discoverers
   * (bootstrap-corpus + page-phase sidebar expander) are NOT run, so the frontier
   * starts with ONLY the start URL plus whatever the in-page interaction harnesses
   * surface. Use this to keep a smoke/focus run ON the start route instead of
   * flooding it with stale corpus seeds. Absent / false => discoverers run as
   * before (full-crawl behaviour unchanged).
   */
  noDiscoverers?: boolean;
  /**
   * Additive, opt-in (FOCUSED-CRAWL). When set, any route the crawler would
   * enqueue whose normalised URL does NOT start with this prefix is dropped. This
   * confines navigation to a sub-tree (e.g. a single List view) so DnD / hover /
   * keyboard harnesses get exercised instead of the crawl wandering off. Absent
   * => no scoping (behaviour unchanged). The start URL is always allowed.
   */
  scopePrefix?: string;
  /**
   * Additive, opt-in (FOCUSED-CRAWL). When true, `sanityReset(page)` runs once
   * right after the first authenticated nav + settle, returning the UI to a
   * pristine default baseline (no chat/home panel leak, no stray overlays)
   * BEFORE store discovery and the first capture. Absent / false => behaviour
   * is byte-identical to before this field existed (no reset).
   */
  sanityReset?: boolean;
};

/**
 * Structural sub-type the crawler needs from a profile. Defined here to avoid
 * a circular import; the real `WebappProfile` in `../profiles/types` is
 * assignable to this shape.
 */
export type WebappProfileLike = {
  name: string;
  discoverers?: ReadonlyArray<{
    name: string;
    discover(ctx: {
      host: string;
      origin: string;
      startUrl: string;
      networkLogPaths: readonly string[];
    }): Promise<
      Array<{
        url: string;
        priority?: number;
        sourceTag?: string;
        viewId?: string;
        viewType?: string;
      }>
    >;
  }>;
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
