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
};

export type StateNode = {
  id: string;
  url: string;
  domHash: string;
  title: string;
  screenshotPath: string;
  domPath: string;
  capturedAt: string;
  depth: number;
};

export type StateEdge = {
  fromStateId: string;
  toStateId: string;
  interaction: Interaction;
  capturedAt: string;
};

export type CrawlGraph = {
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
};

export type RecorderHandles = {
  closeAll: () => Promise<void>;
};

export type QueueItem = {
  url: string;
  depth: number;
  viaEdge: Omit<StateEdge, 'toStateId'> | null;
};
