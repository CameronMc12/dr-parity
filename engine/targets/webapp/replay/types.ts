/**
 * Replay target types. The replay target emits a self-contained static site
 * that serves a captured SPA's REAL bootstrap HTML + JS bundle offline and
 * answers every network call from the recorded traffic, so the original app
 * boots and renders functionally without its live backend.
 *
 * Unlike the webapp target (which slices the DOM into React route components),
 * replay keeps the original bundle intact. It is additive and shares no output
 * with the webapp/react/astro targets.
 */

/** A single recorded HTTP exchange, runtime-ready for the Service Worker. */
export type ReplayRecording = {
  method: string;
  /** Templated path pattern derived from the captured group. */
  pathPattern: string;
  /** Origin (scheme + host) the captured request targeted. */
  origin: string;
  /** Stable hash of the normalized request body, '' when no body. */
  requestBodyKey: string;
  status: number;
  /** Response content-type header, used so the SW replies with the right MIME. */
  contentType: string;
  /** Response body verbatim (already redacted). */
  body: string;
  /**
   * Optional list-id-aware discriminator (additive). When present, the SW
   * prefers this recording for a request whose computed match key equals this
   * value, so per-list bridge recordings sharing one wildcarded path pattern
   * (e.g. /hierarchy/v1/subcategory/* or POST tasks/bulk) resolve to the right
   * list. Absent on ordinary captured recordings: behaviour is unchanged.
   */
  matchKey?: string;
};

/** Captured WebSocket connection + its server->client frames, for replay. */
export type ReplayWsConnection = {
  url: string;
  urlPattern: string;
  frames: { direction: 'sent' | 'received'; atMs: number; payload: string }[];
};

/** One object store inside a seeded IndexedDB database. */
export type SeededIdbStore = {
  name: string;
  /** Key path (string or string[]) or null for out-of-line keys. */
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  /** Records to put. `key` is required only for out-of-line stores. */
  records: { key?: IDBValidKey; value: unknown }[];
};

/** One IndexedDB database to recreate in the boot shim. */
export type SeededIdbDatabase = {
  database: string;
  version: number;
  stores: SeededIdbStore[];
};

/** Storage + cookie state seeded into the page before the bundle runs. */
export type SeededState = {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  /** name=value cookie strings (no Domain/Secure attrs; set on the serve host). */
  cookies: string[];
  /** Optional IndexedDB databases to recreate. Absent on older captures. */
  indexedDB: SeededIdbDatabase[];
};

/** How the interceptor answers requests with no recorded match. */
export type UnrecordedMode = 'empty-200' | 'bypass';

export type ReplayBuildOptions = {
  /** Crawl directory carrying network.jsonl, websocket.jsonl, graph.json, states/. */
  crawlDir: string;
  /** Output directory for the runnable replay site. */
  outDir: string;
  /** Overwrite outDir if it exists. */
  force: boolean;
  /** Default handling for unrecorded requests. Defaults to 'empty-200'. */
  unrecordedMode?: UnrecordedMode;
  /** Project name written into replay-manifest.json. */
  name?: string;
  /**
   * Additive: path to a ClickUp export directory. When set, the build merges
   * synthetic INTERNAL-shape recordings for every list/space in the export so
   * the replay renders lists the crawl never captured. Absent: unchanged.
   */
  bridgeExportDir?: string;
  /**
   * Additive: URL of the OWNED local backend (e.g. http://localhost:8787). When
   * set, the emitted Service Worker forwards internal-API requests to this
   * backend first and only falls back to recordings on a backend miss. Absent:
   * the SW serves recordings only (strict no-regression).
   */
  backendUrl?: string;
};

export type ReplayManifest = {
  name: string;
  bootstrapUrl: string;
  assetCount: number;
  /** Count of first-party static assets fetched live from the CDN at build time. */
  backfilledCount: number;
  /** Count of CDN-backfill references that were missing but could not be fetched. */
  backfillFailedCount: number;
  /**
   * CRITICAL first-party assets (bootstrap stylesheet / script / importmap
   * target) that could not be fetched after all retries. Non-empty means the
   * replay boots BROKEN — never ship this build silently.
   */
  backfillCriticalFailures: string[];
  recordingCount: number;
  wsConnectionCount: number;
  wsFrameCount: number;
  storageSeeded: boolean;
  /** True when at least one IndexedDB database was seeded into the boot shim. */
  idbSeeded: boolean;
  /** Number of IndexedDB databases recreated by the boot shim. */
  idbDatabases: number;
  /** Total records written across all seeded IndexedDB stores. */
  idbRecords: number;
  unrecordedMode: UnrecordedMode;
  /** Count of export-bridge recordings merged in (0 unless --bridge-export). */
  bridgeRecordingCount: number;
  /** Count of lists synthesized from the export (0 unless --bridge-export). */
  bridgeListCount: number;
  warnings: string[];
};

export type ReplayBuildResult = {
  outDir: string;
  manifest: ReplayManifest;
  serveCommand: string;
};
