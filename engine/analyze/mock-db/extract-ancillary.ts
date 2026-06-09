import type {
  CapturedResponse,
  Keyed,
  MockComment,
  MockCustomField,
  MockDoc,
  MockDocPage,
  MockGoal,
  MockTag,
  MockTask,
} from './types.js';
import { matches } from './net-reader.js';
import { fixture, type SeedManifest } from './fixture-fallback.js';

function asStr(v: unknown): string | null {
  return v == null ? null : String(v);
}

export function extractTags(res: CapturedResponse[], spaceId: string): Keyed<MockTag> {
  const tags: Keyed<MockTag> = {};
  for (const r of res) {
    if (!matches(r, /^\/tasks\/v1\/tag\?/)) continue;
    const arr = (r.json as Record<string, unknown>).tags as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) continue;
    for (const t of arr) {
      const name = t.name as string;
      if (!name) continue;
      tags[name] = {
        name,
        fg: (t.tag_fg as string) ?? '#1f1f1f',
        bg: (t.tag_bg as string) ?? '#cccccc',
        spaceId: asStr(t.project_id) ?? spaceId,
        _source: 'captured',
      };
    }
  }
  if (!Object.keys(tags).length) {
    for (const t of fixture.space.tags) {
      tags[t.name] = { name: t.name, fg: t.fg, bg: t.bg, spaceId, _source: 'fixture' };
    }
  }
  return tags;
}

export function extractCustomFields(res: CapturedResponse[]): Keyed<MockCustomField> {
  const fields: Keyed<MockCustomField> = {};
  for (const r of res) {
    // accessibleFields / fields endpoints under customFields/v2 or task-v3
    const j = r.json as Record<string, unknown>;
    const candidates = (j.fields ?? j.custom_fields ?? (Array.isArray(j) ? j : null)) as
      | Array<Record<string, unknown>>
      | null;
    if (!Array.isArray(candidates)) continue;
    if (!/customField|accessibleFields|\/fields/i.test(r.url)) continue;
    for (const f of candidates) {
      const id = asStr(f.id);
      if (!id || !f.name) continue;
      const cfg = (f.type_config ?? {}) as Record<string, unknown>;
      const opts = (cfg.options as Array<Record<string, unknown>>) ?? [];
      fields[id] = {
        id,
        name: f.name as string,
        type: (f.type as string) ?? 'text',
        options: opts.map((o, i) => ({
          id: asStr(o.id),
          name: (o.name ?? o.label) as string,
          color: (o.color as string) ?? null,
          orderindex: typeof o.orderindex === 'number' ? o.orderindex : i,
        })),
        _source: 'captured',
      };
    }
  }
  return fields;
}

export function extractComments(
  res: CapturedResponse[],
  tasks: Keyed<MockTask>,
): Keyed<MockComment> {
  const comments: Keyed<MockComment> = {};
  const ingest = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const c of arr as Array<Record<string, unknown>>) {
      const id = asStr(c.id);
      if (!id) continue;
      const text =
        typeof c.comment_text === 'string'
          ? c.comment_text
          : Array.isArray(c.comment)
            ? (c.comment as Array<{ text?: string }>).map((p) => p.text ?? '').join('')
            : '';
      const taskId = asStr(c.parent ?? c.root_parent_id);
      comments[id] = {
        id,
        taskId,
        text,
        userId: asStr(c.userid),
        date: asStr(c.date),
        resolved: Boolean(c.resolved),
        _source: 'captured',
      };
    }
  };
  for (const r of res) {
    if (!/comment-service/i.test(r.url)) continue;
    const j = r.json as Record<string, unknown>;
    ingest(j.comments);
    for (const p of (j.comment_parents as Array<Record<string, unknown>>) ?? []) {
      ingest((p.data as Record<string, unknown>)?.comments);
    }
  }
  // wire comment counts onto tasks
  for (const c of Object.values(comments)) {
    if (c.taskId && tasks[c.taskId]) tasks[c.taskId].commentCount += 1;
  }
  return comments;
}

export function extractGoals(res: CapturedResponse[], manifest: SeedManifest): Keyed<MockGoal> {
  const goals: Keyed<MockGoal> = {};
  for (const r of res) {
    if (!/\/goals?\/v1\//.test(r.url)) continue;
    const arr = (r.json as Record<string, unknown>).goals as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) continue;
    for (const g of arr) {
      const id = asStr(g.id);
      if (!id) continue;
      goals[id] = {
        id,
        name: (g.name as string) ?? '',
        prettyId: asStr(g.pretty_id),
        description: (g.description as string) ?? null,
        dueDate: asStr(g.due_date),
        startDate: asStr(g.start_date),
        dateCreated: asStr(g.date_created),
        ownerId: asStr(g.owner ?? g.creator),
        private: Boolean(g.private),
        _source: 'captured',
      };
    }
  }
  if (!Object.keys(goals).length) {
    for (const g of fixture.space.goals) {
      const id = manifest.ids[g.key];
      if (!id) continue;
      goals[id] = {
        id,
        name: g.name,
        prettyId: null,
        description: g.description,
        dueDate: null,
        startDate: null,
        dateCreated: null,
        ownerId: null,
        private: false,
        _source: 'fixture',
      };
    }
  }
  return goals;
}

/** Docs content was not captured as JSON; build from fixture under real ids. */
export function extractDocs(manifest: SeedManifest): {
  docs: Keyed<MockDoc>;
  pages: Keyed<MockDocPage>;
} {
  const docs: Keyed<MockDoc> = {};
  const pages: Keyed<MockDocPage> = {};
  for (const d of fixture.space.docs) {
    const docId = manifest.ids[d.key];
    if (!docId) continue;
    const pageIds: string[] = [];
    d.pages.forEach((p, i) => {
      const pageId = manifest.ids[p.key];
      if (!pageId) return;
      pageIds.push(pageId);
      pages[pageId] = {
        id: pageId,
        name: p.name,
        content: p.content,
        docId,
        orderindex: i,
        _source: 'fixture',
      };
    });
    docs[docId] = {
      id: docId,
      name: d.name,
      workspaceId: manifest.teamId,
      pageIds,
      _source: 'fixture',
    };
  }
  return { docs, pages };
}
