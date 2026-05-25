/**
 * Stream the crawl's network.jsonl and pull the populated INTERNAL-shape
 * response bodies the ClickUp bundle actually consumes, plus the request bodies
 * that produced them. These captured bodies are the structural skeletons the
 * bridge clones and overlays export data onto: cloning the real shape (and
 * keeping every default/structural field the bundle expects) is far safer than
 * synthesizing the deep internal task shape from scratch.
 *
 * We only need ONE populated capture per endpoint kind. The first match wins.
 * network.jsonl is multi-GB, so we STREAM it line-by-line (never readFileSync)
 * and stop early once every template we care about is found.
 */

import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

type RawRequestLine = {
  kind: 'request';
  method: string;
  url: string;
  postData?: string | null;
};

type RawResponseLine = {
  kind: 'response';
  status: number;
  url: string;
  headers?: Record<string, string>;
  body?: string | null;
  bodyEncoding?: 'utf8' | 'base64';
};

/** The captured internal-shape skeletons the bridge mappers clone from. */
export type CapturedTemplates = {
  /** GET /hierarchy/v3/.../tree — sidebar tree (parsed JSON). */
  sidebarTree: unknown | null;
  /** GET /hierarchy/v1/project?team= — array of project/space objects. */
  project: unknown[] | null;
  /** GET /hierarchy/v1/subcategory/{listId} — one list-detail object. */
  subcategory: Record<string, unknown> | null;
  /** POST /view/v1/genericView — the view payload carrying divisions/groups. */
  genericView: Record<string, unknown> | null;
  /** POST /task-v3/.../tasks/bulk — the populated task-array payload (~37KB). */
  tasksBulk: Record<string, unknown> | null;
  /** The list id the captured templates describe (for token substitution). */
  capturedListId: string | null;
};

type TemplateKey = keyof Omit<CapturedTemplates, 'capturedListId'>;

function decodeBody(line: RawResponseLine): string {
  const body = line.body ?? '';
  if (line.bodyEncoding === 'base64') {
    try {
      return Buffer.from(body, 'base64').toString('utf8');
    } catch {
      return body;
    }
  }
  return body;
}

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isJsonResponse(line: RawResponseLine): boolean {
  const ct = line.headers?.['content-type'] ?? line.headers?.['Content-Type'] ?? '';
  return /json/i.test(ct);
}

/** A candidate matcher: which template a response URL/body satisfies. */
type Matcher = {
  key: TemplateKey;
  method: 'GET' | 'POST';
  test: (url: string) => boolean;
  /** Optional response-body acceptance test (e.g. only the POPULATED bulk). */
  accept?: (parsed: unknown) => boolean;
};

const MATCHERS: Matcher[] = [
  {
    key: 'sidebarTree',
    method: 'GET',
    test: (u) => /\/hierarchy\/v3\/experience\/sidebar\/workspaces\/\d+\/tree/.test(u),
  },
  {
    key: 'project',
    method: 'GET',
    test: (u) => /\/hierarchy\/v1\/project\b/.test(u) && /[?&]team=/.test(u),
  },
  {
    key: 'subcategory',
    method: 'GET',
    test: (u) => /\/hierarchy\/v1\/subcategory\/\d+/.test(u),
  },
  {
    key: 'genericView',
    method: 'POST',
    test: (u) => /\/view\/v1\/genericView/.test(u),
    // Only accept a genericView whose groups carry task_ids (the populated list
    // view). The bundle also fires an empty placeholder genericView whose groups
    // exist but hold no task ids; that skeleton renders nothing.
    accept: (parsed) => {
      const v = parsed as { list?: { divisions?: unknown[] } };
      const divisions = v?.list?.divisions;
      if (!Array.isArray(divisions) || divisions.length === 0) return false;
      return divisions.some((d) => {
        const groups = (d as { groups?: { task_ids?: unknown[] }[] }).groups;
        if (!Array.isArray(groups)) return false;
        return groups.some((g) => Array.isArray(g.task_ids) && g.task_ids.length > 0);
      });
    },
  },
  {
    key: 'tasksBulk',
    method: 'POST',
    test: (u) => /\/task-v3\/experience\/\d+\/tasks\/bulk/.test(u),
    // Only accept the POPULATED bulk (a non-empty tasks array). The bundle also
    // fires an empty-ids probe whose response carries zero tasks.
    accept: (parsed) => {
      const v = parsed as { tasks?: unknown[] };
      return Array.isArray(v?.tasks) && v.tasks.length > 0;
    },
  },
];

function listIdFromSubcategoryUrl(url: string): string | null {
  const m = url.match(/\/hierarchy\/v1\/subcategory\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Stream the crawl network log and capture one populated body per template.
 * Returns as soon as all templates are found, or at EOF.
 */
export async function extractTemplates(crawlDir: string): Promise<CapturedTemplates> {
  const networkPath = join(crawlDir, 'network.jsonl');
  const out: CapturedTemplates = {
    sidebarTree: null,
    project: null,
    subcategory: null,
    genericView: null,
    tasksBulk: null,
    capturedListId: null,
  };
  if (!existsSync(networkPath)) return out;

  // Track pending request post-bodies by "METHOD url" so we can read the
  // request body that produced a captured response (e.g. genericView's parent).
  const pendingPost = new Map<string, string[]>();

  const rl = createInterface({
    input: createReadStream(networkPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const remaining = new Set<TemplateKey>(MATCHERS.map((m) => m.key));

  for await (const line of rl) {
    if (line.trim().length === 0) continue;
    if (remaining.size === 0) break;

    const parsed = parseJson(line) as RawRequestLine | RawResponseLine | null;
    if (!parsed) continue;

    if (parsed.kind === 'request') {
      if (parsed.method.toUpperCase() === 'POST') {
        const key = `POST ${parsed.url}`;
        const list = pendingPost.get(key) ?? [];
        list.push(parsed.postData ?? '');
        pendingPost.set(key, list);
      }
      continue;
    }

    if (parsed.kind !== 'response') continue;
    if (!isJsonResponse(parsed)) continue;

    for (const matcher of MATCHERS) {
      if (!remaining.has(matcher.key)) continue;
      if (!matcher.test(parsed.url)) continue;

      const decoded = decodeBody(parsed);
      const body = parseJson(decoded);
      if (body === null) continue;
      if (matcher.accept && !matcher.accept(body)) continue;

      switch (matcher.key) {
        case 'sidebarTree':
          out.sidebarTree = body;
          break;
        case 'project':
          out.project = Array.isArray(body) ? body : null;
          if (!out.project) continue;
          break;
        case 'subcategory':
          out.subcategory = body as Record<string, unknown>;
          out.capturedListId = listIdFromSubcategoryUrl(parsed.url) ?? out.capturedListId;
          break;
        case 'genericView':
          out.genericView = body as Record<string, unknown>;
          break;
        case 'tasksBulk':
          out.tasksBulk = body as Record<string, unknown>;
          break;
      }
      remaining.delete(matcher.key);
      break;
    }
  }

  rl.close();
  return out;
}
