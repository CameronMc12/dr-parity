/**
 * Source the StateCases the state avenue rounds-trips against the owned CQRS
 * backend.
 *
 * Two sources, in priority order:
 *   1. CAPTURED — mutating task writes mined from the crawl's network.jsonl
 *      (POST/PUT/DELETE against task-v3 that carry a write body). When the crawl
 *      contains real command observations they become the cases.
 *   2. SYNTHETIC — deterministic CRUD cases (CreateTask -> read reflects;
 *      SetTaskStatus -> read reflects status) seeded with real list ids mined
 *      from the crawl so the cases exercise plausible data.
 *
 * The ClickUp crawl this engine targets was captured read-only (the user
 * browsed, did not mutate), so in practice the synthetic path supplies the
 * cases. `sourceState-cases` records which path was used so the report is honest.
 */

import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

/** A command the state avenue will apply, plus the effect it must produce. */
export type CommandSpec =
  | {
      command: 'CreateTask';
      payload: { listId: string; name: string; status: string; taskId: string };
      /** After applying, reading taskId must yield this projection subset. */
      expect: { taskId: string; listId: string; name: string; status: string };
    }
  | {
      command: 'SetTaskStatus';
      payload: { taskId: string; status: string };
      /** A CreateTask that must run first so the target task exists. */
      setup: { listId: string; name: string; status: string; taskId: string };
      expect: { taskId: string; status: string };
    };

export type StateCaseSet = {
  specs: CommandSpec[];
  /** 'captured' when mined from crawl writes, else 'synthetic'. */
  source: 'captured' | 'synthetic';
  notes: string[];
};

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TASK_WRITE = /task-v3\/.*\/tasks(\/|$)/i;
const MAX_LINES = 400_000;

/** Mine real list ids from the crawl graph startUrl + node urls (best effort). */
function listIdsFromCrawl(crawlDir: string): string[] {
  const ids = new Set<string>();
  try {
    const graphPath = join(crawlDir, 'graph.json');
    if (existsSync(graphPath)) {
      // Cheap: pull numeric list ids out of the urls without a full DOM walk.
      const raw = readFileSync(graphPath, 'utf8');
      for (const m of raw.matchAll(/\/(?:li|l)\/(\d{6,})/g)) ids.add(m[1]!);
      for (const m of raw.matchAll(/"startUrl":\s*"[^"]*?\/(\d{6,})/g)) ids.add(m[1]!);
    }
  } catch {
    /* fall through to default */
  }
  return ids.size > 0 ? [...ids] : ['901523543284'];
}

/**
 * Stream the crawl's network.jsonl looking for mutating task writes. Returns
 * captured command specs when the crawl actually contains task mutations.
 */
async function minedCapturedSpecs(crawlDir: string): Promise<CommandSpec[]> {
  const netPath = join(crawlDir, 'network.jsonl');
  if (!existsSync(netPath)) return [];
  const specs: CommandSpec[] = [];
  const rl = createInterface({ input: createReadStream(netPath), crlfDelay: Infinity });
  let lines = 0;
  try {
    for await (const line of rl) {
      if (++lines > MAX_LINES) break;
      if (!line) continue;
      let entry: { kind?: string; method?: string; url?: string; postData?: unknown };
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.kind === 'response') continue;
      const method = (entry.method ?? '').toUpperCase();
      const url = entry.url ?? '';
      if (!WRITE_METHODS.has(method) || !TASK_WRITE.test(url)) continue;
      const body = parseCapturedBody(entry.postData);
      const spec = capturedWriteToSpec(method, url, body);
      if (spec) specs.push(spec);
    }
  } finally {
    rl.close();
  }
  return specs;
}

function parseCapturedBody(postData: unknown): Record<string, unknown> | null {
  if (typeof postData !== 'string' || postData.length === 0) return null;
  try {
    const parsed = JSON.parse(postData);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Map a captured task write to a command spec. Only a genuine create
 * (has a `name`, no `ids` search shape) or a status change becomes a case; the
 * crawl's `tasks/bulk` POSTs are reads (id+field search) and are ignored.
 */
function capturedWriteToSpec(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): CommandSpec | null {
  if (!body) return null;
  // Reads disguised as POST: a bulk fetch carries `ids` + `fields`, no `name`.
  if ('ids' in body && 'fields' in body && !('name' in body)) return null;

  const name = typeof body.name === 'string' ? body.name : null;
  const listId = typeof body.list === 'string' ? body.list : typeof body.list_id === 'string' ? body.list_id : null;
  if (method === 'POST' && name && listId) {
    const status = typeof body.status === 'string' ? body.status : 'open';
    const taskId = `cap_${Buffer.from(url + name).toString('hex').slice(0, 8)}`;
    return {
      command: 'CreateTask',
      payload: { listId, name, status, taskId },
      expect: { taskId, listId, name, status },
    };
  }
  const status = typeof body.status === 'string' ? body.status : null;
  const taskMatch = url.match(/tasks\/([A-Za-z0-9]+)/);
  if ((method === 'PUT' || method === 'PATCH') && status && taskMatch) {
    const taskId = taskMatch[1]!;
    return {
      command: 'SetTaskStatus',
      payload: { taskId, status },
      setup: { listId: 'captured', name: `captured-${taskId}`, status: 'open', taskId },
      expect: { taskId, status },
    };
  }
  return null;
}

/** Deterministic synthetic CRUD cases seeded with real crawl list ids. */
function syntheticSpecs(listIds: string[]): CommandSpec[] {
  const listId = listIds[0]!;
  const altList = listIds[1] ?? listId;
  return [
    {
      command: 'CreateTask',
      payload: { listId, name: 'Draft release notes', status: 'open', taskId: 'syn_create_1' },
      expect: { taskId: 'syn_create_1', listId, name: 'Draft release notes', status: 'open' },
    },
    {
      command: 'CreateTask',
      payload: { listId: altList, name: 'Review PR backlog', status: 'in progress', taskId: 'syn_create_2' },
      expect: { taskId: 'syn_create_2', listId: altList, name: 'Review PR backlog', status: 'in progress' },
    },
    {
      command: 'CreateTask',
      payload: { listId, name: 'Ship parity harness', status: 'open', taskId: 'syn_create_3' },
      expect: { taskId: 'syn_create_3', listId, name: 'Ship parity harness', status: 'open' },
    },
    {
      command: 'SetTaskStatus',
      payload: { taskId: 'syn_status_1', status: 'done' },
      setup: { listId, name: 'Close the loop', status: 'open', taskId: 'syn_status_1' },
      expect: { taskId: 'syn_status_1', status: 'done' },
    },
    {
      command: 'SetTaskStatus',
      payload: { taskId: 'syn_status_2', status: 'in review' },
      setup: { listId: altList, name: 'Audit the unhappy path', status: 'open', taskId: 'syn_status_2' },
      expect: { taskId: 'syn_status_2', status: 'in review' },
    },
  ];
}

/**
 * Build the state-avenue case set. Prefers captured mutating writes; falls back
 * to synthetic CRUD seeded from real crawl list ids when the crawl has none.
 */
export async function buildStateCaseSet(crawlDir: string | null): Promise<StateCaseSet> {
  const notes: string[] = [];
  if (crawlDir && existsSync(crawlDir)) {
    const captured = await minedCapturedSpecs(crawlDir);
    if (captured.length > 0) {
      notes.push(`mined ${captured.length} mutating task write(s) from crawl network.jsonl`);
      return { specs: captured, source: 'captured', notes };
    }
    notes.push('crawl contained no mutating task writes (read-only session); using synthetic CRUD cases');
    return { specs: syntheticSpecs(listIdsFromCrawl(crawlDir)), source: 'synthetic', notes };
  }
  notes.push('no crawl dir supplied; using synthetic CRUD cases seeded with default list id');
  return { specs: syntheticSpecs(['901523543284']), source: 'synthetic', notes };
}
