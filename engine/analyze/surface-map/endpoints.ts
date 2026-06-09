/**
 * Streaming accumulator that normalizes recorded API requests into
 * deduplicated endpoint templates grouped by microservice. Correlates
 * response body shapes by URL across the stream.
 */

import type {
  EndpointEntry,
  EndpointsByService,
  NetworkRequestLine,
  NetworkResponseLine,
  ShapeValue,
} from './types.js';
import { isRequest, isResponse, decodeBody } from './jsonl.js';
import { shapeFromBody } from './shape.js';

/** API hosts whose paths are microservice-namespaced. */
const API_HOSTS = new Set([
  'frontdoor-prod-eu-west-1-3.clickup.com',
  'frontdoor-search.clickup-eu.com',
]);

const HEX24_RE = /^[0-9a-f]{24}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_RE = /^\d{3,}$/;
const VIEW_ID_RE = /^[a-z0-9]+-\d+$/i;
const HEX_BLOB_RE = /^[0-9a-f]{12,}$/i;
// ClickUp task ids: base-36 style, contain both letters and digits, len >= 6.
const TASK_ID_RE = /^(?=.*[a-z])(?=.*\d)[a-z0-9]{6,}$/i;
/** Words whose immediately-following segment is an id even if it is short. */
const ID_CONTEXT = new Set(['task', 'tasks', 'comments', 'comment', 'list', 'lists']);

/** Words that look id-ish but are meaningful path segments — never tokenize. */
const KEEP_WORDS = new Set([
  'tree', 'search', 'bulk', 'jobs', 'sidebar', 'workspaces', 'experience',
  'handshake', 'task', 'fields', 'field', 'project', 'comment', 'data',
  'inbox', 'plan', 'cards', 'notification', 'gateway', 'graphql', 'shard',
]);

function tokenizeSegment(seg: string, prev: string): string {
  if (!seg) return seg;
  if (KEEP_WORDS.has(seg.toLowerCase())) return seg;
  if (UUID_RE.test(seg)) return ':uuid';
  if (HEX24_RE.test(seg)) return ':id';
  if (VIEW_ID_RE.test(seg)) return ':viewId';
  if (TASK_ID_RE.test(seg)) return ':taskId';
  if (NUMERIC_RE.test(seg)) return ':id';
  if (HEX_BLOB_RE.test(seg)) return ':hash';
  // Short numeric id in an id-context (e.g. /task/86, /comments/0).
  if (ID_CONTEXT.has(prev.toLowerCase()) && /^\d+$/.test(seg)) return ':id';
  return seg;
}

function buildTemplate(pathname: string): string {
  const segs = pathname.split('/');
  return segs.map((seg, i) => tokenizeSegment(seg, segs[i - 1] ?? '')).join('/');
}

function serviceAndVersion(template: string): { service: string; version: string } {
  const segs = template.split('/').filter(Boolean);
  return {
    service: segs[0] ?? 'unknown',
    version: segs.find((s) => /^v\d+$/.test(s)) ?? 'v?',
  };
}

/** Single-pass accumulator: feed every request and response line into it. */
export class EndpointAccumulator {
  private byKey = new Map<string, EndpointEntry>();
  /** url -> first response body shape seen (cached for late-arriving requests). */
  private responseShapes = new Map<string, ShapeValue | null>();

  add(line: NetworkRequestLine | NetworkResponseLine): void {
    if (isResponse(line)) {
      this.addResponse(line);
      return;
    }
    if (isRequest(line)) this.addRequest(line);
  }

  private addResponse(line: NetworkResponseLine): void {
    if (this.responseShapes.has(line.url)) return;
    let host: string;
    try {
      host = new URL(line.url).host;
    } catch {
      return;
    }
    if (!API_HOSTS.has(host)) return;
    const shape = shapeFromBody(decodeBody(line.body, line.bodyEncoding));
    this.responseShapes.set(line.url, shape);
    // Backfill any endpoint that already saw this url with no resp shape.
    for (const entry of this.byKey.values()) {
      if (entry.sampleResponseBodyShape == null && entry.exampleUrl === line.url && shape != null) {
        entry.sampleResponseBodyShape = shape;
      }
    }
  }

  private addRequest(line: NetworkRequestLine): void {
    let parsed: URL;
    try {
      parsed = new URL(line.url);
    } catch {
      return;
    }
    if (!API_HOSTS.has(parsed.host)) return;

    const template = buildTemplate(parsed.pathname);
    const method = (line.method || 'GET').toUpperCase();
    const key = `${method} ${template}`;

    let entry = this.byKey.get(key);
    if (!entry) {
      const { service, version } = serviceAndVersion(template);
      entry = {
        service,
        version,
        method,
        pathTemplate: template,
        exampleUrl: line.url,
        count: 0,
        sampleRequestBodyShape: null,
        sampleResponseBodyShape: null,
      };
      this.byKey.set(key, entry);
    }
    entry.count += 1;

    if (entry.sampleRequestBodyShape == null && line.postData) {
      entry.sampleRequestBodyShape = shapeFromBody(line.postData);
    }
    if (entry.sampleResponseBodyShape == null) {
      const shape = this.responseShapes.get(line.url);
      if (shape != null) entry.sampleResponseBodyShape = shape;
    }
  }

  result(): EndpointsByService {
    const grouped: EndpointsByService = {};
    for (const entry of this.byKey.values()) {
      (grouped[entry.service] ??= []).push(entry);
    }
    for (const list of Object.values(grouped)) {
      list.sort((a, b) =>
        a.pathTemplate === b.pathTemplate
          ? a.method.localeCompare(b.method)
          : a.pathTemplate.localeCompare(b.pathTemplate),
      );
    }
    return grouped;
  }
}

export function countEndpoints(grouped: EndpointsByService): number {
  return Object.values(grouped).reduce((n, list) => n + list.length, 0);
}
