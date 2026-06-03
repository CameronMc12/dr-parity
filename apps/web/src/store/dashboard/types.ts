/**
 * Dashboard store type contract. A dashboard is an ordered set of cards laid
 * out on a 12-column grid, keyed by the dashboard's viewId. All geometry is in
 * grid units (w/h) and grid coordinates (x/y); the renderer multiplies by the
 * column width / row height. Persisted to localStorage via the persist
 * middleware (see ./index).
 */

/** Every card kind the registry knows how to render. */
export type CardType =
  | 'stat'
  | 'aiSummary'
  | 'pie'
  | 'bar'
  | 'taskList'
  | 'calculation'
  | 'portfolio'
  | 'embed';

/** Which task field a stat/chart card buckets or counts over. */
export type CardMetric =
  | 'unassigned'
  | 'inProgress'
  | 'completed'
  | 'total'
  | 'completedThisWeek';

export type CardGrouping = 'status' | 'assignee' | 'priority';

/**
 * Per-card configuration. Optional so a freshly added card falls back to its
 * registry default. `metric` drives stat cards; `grouping` drives charts.
 */
export interface CardConfig {
  metric?: CardMetric;
  grouping?: CardGrouping;
  /** Only count open (non-closed) tasks. Used by assignee charts. */
  openOnly?: boolean;
  /** Free-text body for the embed card. */
  url?: string;
}

/** Subset of task filters a single card may pin (independent of the view). */
export interface CardFilters {
  status: string[];
  assignee: string[];
}

export interface DashboardCard {
  id: string;
  type: CardType;
  title: string;
  /** Grid column (0-based, 0..11). */
  x: number;
  /** Grid row (0-based). */
  y: number;
  /** Width in grid columns (1..12). */
  w: number;
  /** Height in grid rows. */
  h: number;
  config?: CardConfig;
  filters?: CardFilters;
  /**
   * Bumped each time the card's "Refresh" action fires. Card bodies key off it
   * (via the renderer's `card.refreshTick`) so a manual refresh re-runs the
   * card's derivation without touching global state. Not persisted as meaningful
   * history — it is just a monotonically increasing nonce.
   */
  refreshTick?: number;
}

/** One dashboard: its ordered cards plus board-level options. */
export interface Dashboard {
  cards: DashboardCard[];
  autoRefresh: boolean;
}

export interface DashboardActions {
  /** Add a card of `type` at the next free row; returns the new card id. */
  addCard: (viewId: string, type: CardType) => string;
  removeCard: (viewId: string, id: string) => void;
  moveCard: (viewId: string, id: string, x: number, y: number) => void;
  resizeCard: (viewId: string, id: string, w: number, h: number) => void;
  updateCardConfig: (viewId: string, id: string, config: CardConfig) => void;
  renameCard: (viewId: string, id: string, title: string) => void;
  duplicateCard: (viewId: string, id: string) => void;
  setCardFilters: (viewId: string, id: string, filters: CardFilters) => void;
  setAutoRefresh: (viewId: string, on: boolean) => void;
  /** Bump a single card's refresh nonce (re-runs its body). */
  refreshCard: (viewId: string, id: string) => void;
  /** Bump every card's refresh nonce on a board (toolbar "Refresh"). */
  refreshAll: (viewId: string) => void;
  /** Ensure a default dashboard exists for a viewId (idempotent). */
  ensureDashboard: (viewId: string) => void;
}

export interface DashboardState extends DashboardActions {
  /** dashboards keyed by viewId. */
  dashboards: Record<string, Dashboard>;
  /** Deterministic, persisted id counter for new cards. */
  cardCounter: number;
}
