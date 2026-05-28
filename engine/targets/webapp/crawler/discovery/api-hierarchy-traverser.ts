/**
 * API-hierarchy traverser.
 *
 * Two-pass scan of captured `network.jsonl` files producing `(viewId, urlSegment, confidence)`
 * tuples that the hybrid discoverer synthesises into navigable view URLs.
 *
 * Pass A — STRICT
 *   Walk view-enumeration endpoints only:
 *     - /hierarchy/v3/experience/sidebar/workspaces/<wsId>/views
 *     - /viz/v1/subcategory/<listId>/views
 *     - /hierarchy/v1/project/<listId>/category
 *   A view qualifies when it carries an explicit `view_id` OR a view-id-shaped
 *   `id` AND a numeric `type` / `view_entity_type` sibling. Confidence = strict.
 *
 * Pass B — INFERRED (sibling)
 *   Walk EVERY response body (not just the strict endpoints), and for each
 *   view-shaped object that carries a numeric `type`/`view_entity_type` OR a
 *   string `type`/`view_type`/`category`, record the inferred URL segment.
 *   Confidence = inferred.
 *
 * Pass C — INFERRED (URL hint)
 *   Scan every captured request/response URL for two shapes:
 *     - the explicit SPA URL pattern  `/v/<seg>/<viewId>`
 *     - a path word like `/calendar_view/<viewId>` or `/list/<viewId>`
 *   When found, attach the segment to the viewId. Confidence = inferred.
 *
 * Pass D — FALLBACK (no type signal)
 *   Loose-scan every response body for any view-id-shaped string. For any
 *   viewId NOT type-resolved by A/B/C, emit ONE entry per known view-type
 *   segment, marked `fallback`. The crawler will discover which ones 200 vs
 *   404 by visiting them.
 *
 * Tier dedup: when the same viewId surfaces in multiple passes, the highest
 * confidence wins. A `strict` seed always overrides an `inferred` seed for
 * the same viewId; `inferred` overrides `fallback`; `fallback` is only kept
 * when no other pass found the id.
 *
 * Robustness: any parse error on a single body is logged (verbose) + skipped
 * — the traverser never throws into the caller.
 */

import { createReadStream, readdirSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { isAbsolute, join, resolve } from 'node:path';
import { URL } from 'node:url';

import type { SeedConfidence } from './types';

const LOG_PREFIX = '[hybrid-discoverer]';

// =============================================================================
// Constants — view-id shape, type maps, blocklists
// =============================================================================

/**
 * Conservative view-id shape:
 *   - 2 or 3 hyphen-separated segments
 *   - first segment alphanumeric, NOT a known noise word, NOT a date prefix,
 *     NOT a hex hash, NOT a long snowflake id
 *   - remaining segments all digits
 * Examples that match: `2kyr6013-75`, `6-901523542894-1`, `5-901516144663-28`.
 * Examples that DON'T match: `2026-05-26`, `alpha-1`, hex-blob-1779782065.
 */
const VIEW_ID_REGEX = /^[a-z0-9]+-\d+(?:-\d+)?$/;

/**
 * Noise prefixes seen in captured ClickUp bodies that look like view ids but
 * aren't. Empirically derived; keep tight to avoid over-filtering. Extending
 * this list is safe (we drop more candidates) — shrinking it is risky.
 */
const NOISE_ID_PREFIXES = new Set([
  'alpha',
  'profile',
  'home',
  'utf',
  'page',
  'version',
  'color',
  'date',
  'default',
  'primary',
  'task',
  'section',
  'column',
  'row',
  'order',
  'status',
  'priority',
  'category',
  'folder',
  'field',
  'filter',
  'group',
  'viewport',
  'workspace',
  'space',
  'user',
  'team',
]);

/**
 * Numeric `type` → URL segment. Inverted from the ClickUp routes we have
 * ground truth for. Stable across captures.
 */
const NUMERIC_TYPE_TO_URL_SEGMENT: Record<number, string> = {
  1: 'l', // list
  2: 'b', // board
  3: 'c', // calendar
  4: 'g', // gantt
  5: 'tl', // timeline
  6: 't', // table
  9: 'dc', // doc
};

/** `view_entity_type` → URL segment. Conservative; only ground-truth codes. */
const ENTITY_TYPE_TO_URL_SEGMENT: Record<number, string> = {
  14: 'dc', // doc
};

/**
 * String-token → URL segment. Used by:
 *   - sibling string fields (`type`, `view_type`, `category`, `viewType`)
 *   - URL path words (e.g. `/calendar_view/<id>`, `/list/<id>`)
 * Lowercased, underscore-normalised before lookup.
 */
const STRING_TOKEN_TO_URL_SEGMENT: Record<string, string> = {
  list: 'l',
  list_view: 'l',
  board: 'b',
  board_view: 'b',
  calendar: 'c',
  calendar_view: 'c',
  gantt: 'g',
  gantt_view: 'g',
  timeline: 'tl',
  timeline_view: 'tl',
  table: 't',
  table_view: 't',
  doc: 'dc',
  docs: 'dc',
  doc_view: 'dc',
};

/**
 * Known URL segments used in `/v/<segment>/<viewId>`. Drives the fallback
 * fan-out: when a viewId has no type signal at all, the discoverer emits one
 * candidate URL per segment here. Keep this list TIGHT — every extra segment
 * multiplies the fallback seed count.
 */
const KNOWN_URL_SEGMENTS: ReadonlyArray<string> = ['l', 'b', 't', 'c', 'g', 'tl', 'dc'];

/** Strict view-enumeration endpoints (Pass A). */
function isViewEnumerationUrl(url: string): boolean {
  if (!url) return false;
  if (/\/hierarchy\/v3\/experience\/sidebar\/workspaces\/\d+\/views(\b|\?|$)/.test(url)) return true;
  if (/\/viz\/v1\/subcategory\/\d+\/views(\b|\?|$)/.test(url)) return true;
  if (/\/hierarchy\/v1\/project\/\d+\/category(\b|\?|$)/.test(url)) return true;
  return false;
}

/** True if the candidate string is plausibly a ClickUp viewId. */
function isPlausibleViewId(candidate: string): boolean {
  if (!candidate || candidate.length > 40) return false;
  if (!VIEW_ID_REGEX.test(candidate)) return false;
  const prefix = candidate.split('-')[0];
  if (NOISE_ID_PREFIXES.has(prefix)) return false;
  // Date prefix `yyyy-mm` or `yyyy-mm-dd`
  if (/^\d{4}$/.test(prefix)) return false;
  // Hex hash prefix (>= 24 hex chars)
  if (prefix.length >= 24 && /^[0-9a-f]+$/.test(prefix)) return false;
  // Long snowflake id prefix
  if (/^\d{15,}$/.test(prefix)) return false;
  // Pure-digit prefixes longer than 3 digits (filters timestamp prefixes)
  if (/^\d+$/.test(prefix) && prefix.length > 3) return false;
  return true;
}

// =============================================================================
// Tiered view record — what each pass emits
// =============================================================================

/**
 * A discovered view at a given confidence tier. The hybrid composer merges
 * many of these into the final seeds.
 */
export type ExtractedView = {
  viewId: string;
  /** URL segment used in `/v/<segment>/<viewId>`. */
  urlSegment: string;
  confidence: SeedConfidence;
  /** Which pass produced the record (advisory). */
  pass: 'strict' | 'sibling-numeric' | 'sibling-string' | 'url-hint' | 'fallback';
  /** Numeric `type` if known. */
  type?: number;
  /** Numeric `view_entity_type` if known. */
  viewEntityType?: number;
};

// =============================================================================
// JSONL streaming
// =============================================================================

async function* iterateJsonlLines(path: string): AsyncGenerator<string> {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      yield line;
    }
  } finally {
    rl.close();
    stream.destroy();
  }
}

function tryParseJson<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// =============================================================================
// Pass A — STRICT extraction (view-enumeration endpoints)
// =============================================================================

function resolveSegmentFromNumeric(type: unknown, entity: unknown): string | null {
  if (typeof type === 'number' && NUMERIC_TYPE_TO_URL_SEGMENT[type]) {
    return NUMERIC_TYPE_TO_URL_SEGMENT[type];
  }
  if (typeof entity === 'number' && ENTITY_TYPE_TO_URL_SEGMENT[entity]) {
    return ENTITY_TYPE_TO_URL_SEGMENT[entity];
  }
  return null;
}

function* walkForStrictViews(node: unknown): Generator<ExtractedView> {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walkForStrictViews(item);
    return;
  }
  if (typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  let candidate: string | null = null;
  const explicit = obj.view_id;
  if (typeof explicit === 'string' && isPlausibleViewId(explicit)) {
    candidate = explicit;
  } else {
    const maybeId = obj.id;
    if (typeof maybeId === 'string' && isPlausibleViewId(maybeId)) {
      if (typeof obj.type === 'number' || typeof obj.view_entity_type === 'number') {
        candidate = maybeId;
      }
    }
  }
  if (candidate) {
    const segment = resolveSegmentFromNumeric(obj.type, obj.view_entity_type);
    if (segment) {
      const view: ExtractedView = {
        viewId: candidate,
        urlSegment: segment,
        confidence: 'strict',
        pass: 'strict',
      };
      if (typeof obj.type === 'number') view.type = obj.type;
      if (typeof obj.view_entity_type === 'number') view.viewEntityType = obj.view_entity_type;
      yield view;
    }
  }

  for (const value of Object.values(obj)) {
    yield* walkForStrictViews(value);
  }
}

// =============================================================================
// Pass B — INFERRED (sibling-field) extraction across ALL bodies
// =============================================================================

function* walkForInferredViews(node: unknown): Generator<ExtractedView> {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walkForInferredViews(item);
    return;
  }
  if (typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  // candidate ids: explicit view_id OR plausible-shaped id
  const candidates: string[] = [];
  const explicit = obj.view_id;
  if (typeof explicit === 'string' && isPlausibleViewId(explicit)) candidates.push(explicit);
  const maybeId = obj.id;
  if (typeof maybeId === 'string' && isPlausibleViewId(maybeId)) candidates.push(maybeId);

  for (const viewId of candidates) {
    // Sibling numeric type
    const numericSegment = resolveSegmentFromNumeric(obj.type, obj.view_entity_type);
    if (numericSegment) {
      const view: ExtractedView = {
        viewId,
        urlSegment: numericSegment,
        confidence: 'inferred',
        pass: 'sibling-numeric',
      };
      if (typeof obj.type === 'number') view.type = obj.type;
      if (typeof obj.view_entity_type === 'number') view.viewEntityType = obj.view_entity_type;
      yield view;
    }
    // Sibling string type
    for (const field of ['view_type', 'viewType', 'category'] as const) {
      const raw = obj[field];
      if (typeof raw !== 'string') continue;
      const seg = STRING_TOKEN_TO_URL_SEGMENT[raw.toLowerCase()];
      if (seg) {
        yield {
          viewId,
          urlSegment: seg,
          confidence: 'inferred',
          pass: 'sibling-string',
        };
      }
    }
  }

  for (const value of Object.values(obj)) {
    yield* walkForInferredViews(value);
  }
}

// =============================================================================
// Pass C — URL-hint extraction (request + response URLs)
// =============================================================================

/** `/v/<seg>/<viewId>` — explicit SPA pattern. */
const URL_V_PATTERN = /\/v\/([a-z]{1,3})\/([a-z0-9]+-\d+(?:-\d+)?)\b/g;
/** `/calendar_view/<id>` style — path-word pattern. */
const URL_WORD_PATTERN =
  /\/(list|board|calendar|gantt|timeline|table|doc)(?:_view)?\/([a-z0-9]+-\d+(?:-\d+)?)\b/gi;

function* extractFromUrl(url: string): Generator<ExtractedView> {
  if (!url) return;
  URL_V_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_V_PATTERN.exec(url)) !== null) {
    const seg = m[1];
    const viewId = m[2];
    if (!isPlausibleViewId(viewId)) continue;
    if (!KNOWN_URL_SEGMENTS.includes(seg)) continue;
    yield {
      viewId,
      urlSegment: seg,
      confidence: 'inferred',
      pass: 'url-hint',
    };
  }
  URL_WORD_PATTERN.lastIndex = 0;
  while ((m = URL_WORD_PATTERN.exec(url)) !== null) {
    const word = m[1].toLowerCase();
    const viewId = m[2];
    if (!isPlausibleViewId(viewId)) continue;
    const seg = STRING_TOKEN_TO_URL_SEGMENT[word];
    if (!seg) continue;
    yield {
      viewId,
      urlSegment: seg,
      confidence: 'inferred',
      pass: 'url-hint',
    };
  }
}

// =============================================================================
// Pass D — FALLBACK loose-scan of bodies for viewIds with no type signal
// =============================================================================

const LOOSE_ID_REGEX = /"([a-z0-9]+-\d+(?:-\d+)?)"/g;

function collectLooseViewIds(rawBody: string, out: Set<string>): void {
  LOOSE_ID_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LOOSE_ID_REGEX.exec(rawBody)) !== null) {
    const id = m[1];
    if (isPlausibleViewId(id)) out.add(id);
  }
}

// =============================================================================
// Main extraction driver
// =============================================================================

export type ExtractOptions = {
  /** Path(s) to scan. Empty array => returns []. */
  networkLogPaths: readonly string[];
  /** Log per-line skip reasons + per-pass counts; defaults to false. */
  verbose?: boolean;
};

export type ExtractStats = {
  scannedLines: number;
  bodiesParsed: number;
  strictCount: number;
  inferredCount: number;
  fallbackUnresolvedCount: number;
  totalUniqueViewIds: number;
};

export type ExtractResult = {
  views: ExtractedView[];
  /** viewIds with no type signal at all — for the fallback fan-out. */
  unresolvedViewIds: string[];
  stats: ExtractStats;
};

/**
 * Run the full multi-pass extraction. Returns:
 *   - the strongest tier extracted per viewId (strict > inferred); a single
 *     viewId may yield multiple records in the resulting `views` array when
 *     different passes disagreed on the segment (rare but possible) — the
 *     caller (hybrid discoverer) does the final tier-collapse.
 *   - the set of viewIds with NO type signal at all (callers fan these out
 *     into one fallback seed per `KNOWN_URL_SEGMENTS`).
 */
export async function extractViewsFromNetworkLogs(
  options: ExtractOptions,
): Promise<ExtractResult> {
  const verbose = options.verbose === true;
  const views: ExtractedView[] = [];
  const allLooseIds = new Set<string>();
  const stats: ExtractStats = {
    scannedLines: 0,
    bodiesParsed: 0,
    strictCount: 0,
    inferredCount: 0,
    fallbackUnresolvedCount: 0,
    totalUniqueViewIds: 0,
  };

  for (const path of options.networkLogPaths) {
    try {
      for await (const line of iterateJsonlLines(path)) {
        stats.scannedLines++;
        if (!line.includes('"kind":"response"')) {
          // Pass C still runs on REQUEST URLs too — they often carry SPA URL hints.
          if (line.includes('"kind":"request"')) {
            const req = tryParseJson<{ url?: unknown }>(line);
            const reqUrl = typeof req?.url === 'string' ? req.url : '';
            for (const v of extractFromUrl(reqUrl)) views.push(v);
          }
          continue;
        }
        const obj = tryParseJson<{ url?: unknown; body?: unknown }>(line);
        if (!obj) continue;
        const url = typeof obj.url === 'string' ? obj.url : '';

        // Pass C — URL-hint extraction (always runs on every record)
        for (const v of extractFromUrl(url)) views.push(v);

        const rawBody = typeof obj.body === 'string' ? obj.body : '';
        if (!rawBody) continue;
        const bodyJson = tryParseJson(rawBody);
        if (bodyJson === null) {
          if (verbose) {
            console.log(`${LOG_PREFIX} body JSON parse failed for ${url}`);
          }
          continue;
        }
        stats.bodiesParsed++;

        // Pass A — strict (only inside view-enumeration endpoints)
        if (isViewEnumerationUrl(url)) {
          for (const v of walkForStrictViews(bodyJson)) views.push(v);
        }
        // Pass B — inferred sibling (all bodies)
        for (const v of walkForInferredViews(bodyJson)) views.push(v);
        // Pass D collection — loose-scan every body's RAW string
        collectLooseViewIds(rawBody, allLooseIds);
      }
    } catch (err) {
      console.log(
        `${LOG_PREFIX} could not read ${path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Compute the unresolved set: loose ids minus any id that any pass type-resolved.
  const typedIds = new Set<string>();
  for (const v of views) typedIds.add(v.viewId);
  const unresolved: string[] = [];
  for (const id of allLooseIds) {
    if (!typedIds.has(id)) unresolved.push(id);
  }

  for (const v of views) {
    if (v.confidence === 'strict') stats.strictCount++;
    else if (v.confidence === 'inferred') stats.inferredCount++;
  }
  stats.fallbackUnresolvedCount = unresolved.length;
  stats.totalUniqueViewIds = new Set([...typedIds, ...unresolved]).size;

  if (verbose || views.length > 0 || unresolved.length > 0) {
    console.log(
      `${LOG_PREFIX} extract scanned=${stats.scannedLines} bodies=${stats.bodiesParsed} strict_records=${stats.strictCount} inferred_records=${stats.inferredCount} unresolved_ids=${stats.fallbackUnresolvedCount} unique_view_ids=${stats.totalUniqueViewIds}`,
    );
  }

  return { views, unresolvedViewIds: unresolved, stats };
}

/**
 * Compose a navigable URL `<origin>/v/<segment>/<viewId>` for a discovered
 * view. ClickUp's view URLs do not require the workspace prefix (the SPA
 * resolves view-id → workspace internally).
 */
export function synthesiseViewUrl(
  origin: string,
  viewId: string,
  urlSegment: string,
): string | null {
  try {
    const base = new URL(origin);
    base.pathname = `/v/${urlSegment}/${viewId}`;
    base.search = '';
    base.hash = '';
    return base.toString();
  } catch {
    return null;
  }
}

/** List of fallback URL segments used when no type signal exists. */
export function fallbackUrlSegments(): ReadonlyArray<string> {
  return KNOWN_URL_SEGMENTS;
}

// =============================================================================
// Bootstrap-corpus glob expansion
// =============================================================================

/**
 * Expand a single glob pattern. Supports ONE `*` per path segment (no `**`, no
 * braces) — deliberately minimal, extended only when a real need appears.
 * Patterns are resolved against `cwd` (the repo root when invoked from CLI).
 * Returns absolute paths to existing files only.
 */
function expandSingleGlob(pattern: string, cwd: string): string[] {
  const abs = isAbsolute(pattern) ? pattern : resolve(cwd, pattern);
  let candidates: string[] = ['/'];
  for (const segment of abs.split('/')) {
    if (segment === '') continue;
    const next: string[] = [];
    for (const base of candidates) {
      if (segment.includes('*')) {
        const re = new RegExp(`^${segment.replace(/\./g, '\\.').replace(/\*/g, '[^/]*')}$`);
        try {
          for (const entry of readdirSync(base)) {
            if (re.test(entry)) next.push(join(base, entry));
          }
        } catch {
          /* base does not exist */
        }
      } else {
        next.push(join(base, segment));
      }
    }
    candidates = next;
  }
  return candidates.filter((p) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

/**
 * Expand every glob in `patterns` and return the deduplicated file list.
 * Empty / undefined input yields an empty array.
 */
export function expandBootstrapCorpus(
  patterns: ReadonlyArray<string> | undefined,
  cwd: string = process.cwd(),
): string[] {
  if (!patterns || patterns.length === 0) return [];
  const out = new Set<string>();
  for (const pattern of patterns) {
    for (const path of expandSingleGlob(pattern, cwd)) out.add(path);
  }
  return Array.from(out);
}
