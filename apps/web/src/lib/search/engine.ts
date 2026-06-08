/**
 * The search engine. Flattens the workspace into a list of indexable entities,
 * then ranks them against a query. Pure and synchronous — cheap enough to run
 * on every keystroke for a local-first workspace. Grouping by kind happens here
 * so the UI just renders.
 */

import { matchBest } from './match';
import type {
  SearchGroup,
  SearchKind,
  SearchResult,
} from './types';
import type {
  DocNode,
  Member,
  SpaceNode,
  Task,
  WorkspaceState,
} from '@/store/workspace/types';

/** Everything the engine needs, decoupled from the live store shape. */
export interface SearchIndex {
  tasks: Task[];
  lists: { id: string; name: string; location: string; color?: string }[];
  folders: { id: string; name: string; location: string; color?: string }[];
  spaces: { id: string; name: string; color: string }[];
  docs: DocNode[];
  members: Member[];
}

const GROUP_ORDER: SearchKind[] = ['task', 'list', 'doc', 'folder', 'space', 'person'];

const GROUP_LABEL: Record<SearchKind, string> = {
  task: 'Tasks',
  list: 'Lists',
  doc: 'Docs',
  folder: 'Folders',
  space: 'Spaces',
  person: 'People',
};

/** Per-kind base weight so tasks outrank spaces at equal text score. */
const KIND_WEIGHT: Record<SearchKind, number> = {
  task: 30,
  list: 20,
  doc: 18,
  folder: 12,
  space: 10,
  person: 14,
};

const MAX_PER_GROUP = 6;

/** Build the flat, searchable index from a workspace snapshot. */
export function buildSearchIndex(state: WorkspaceState): SearchIndex {
  const lists: SearchIndex['lists'] = [];
  const folders: SearchIndex['folders'] = [];
  const spaces: SearchIndex['spaces'] = [];

  for (const space of state.tree.spaces) {
    spaces.push({ id: space.id, name: space.name, color: space.color });
    for (const list of space.folderlessLists) {
      lists.push({ id: list.id, name: list.name, location: space.name, color: space.color });
    }
    for (const folder of space.folders) {
      folders.push({ id: folder.id, name: folder.name, location: space.name, color: space.color });
      for (const list of folder.lists) {
        lists.push({
          id: list.id,
          name: list.name,
          location: `${space.name} / ${folder.name}`,
          color: space.color,
        });
      }
    }
  }

  return {
    tasks: Object.values(state.tasks).filter((t) => !t.archived),
    lists,
    folders,
    spaces,
    docs: state.docs,
    members: state.members,
  };
}

function rank(
  query: string,
  kind: SearchKind,
  id: string,
  title: string,
  subtitle: string,
  extra: { color?: string; initials?: string; fields?: string[] },
): SearchResult | null {
  const hit = matchBest(query, title, ...(extra.fields ?? []));
  if (!hit) return null;
  return {
    id,
    kind,
    title,
    subtitle,
    ranges: hit.ranges,
    score: hit.score + KIND_WEIGHT[kind],
    color: extra.color,
    initials: extra.initials,
  };
}

/** Run a query against the index and return ranked, grouped results. */
export function search(index: SearchIndex, query: string): SearchGroup[] {
  const q = query.trim();
  if (!q) return [];

  const byKind = new Map<SearchKind, SearchResult[]>();
  const push = (r: SearchResult | null) => {
    if (!r) return;
    const bucket = byKind.get(r.kind) ?? [];
    bucket.push(r);
    byKind.set(r.kind, bucket);
  };

  for (const t of index.tasks) {
    push(
      rank(q, 'task', t.id, t.name, t.status, {
        color: t.statusColor,
        fields: [t.description ?? '', t.status, ...t.assignees.map((a) => a.name)],
      }),
    );
  }
  for (const l of index.lists) {
    push(rank(q, 'list', l.id, l.name, l.location, { color: l.color }));
  }
  for (const f of index.folders) {
    push(rank(q, 'folder', f.id, f.name, f.location, { color: f.color }));
  }
  for (const s of index.spaces) {
    push(rank(q, 'space', s.id, s.name, 'Space', { color: s.color }));
  }
  for (const d of index.docs) {
    push(rank(q, 'doc', d.id, d.name, d.location, {}));
  }
  for (const m of index.members) {
    push(
      rank(q, 'person', m.id, m.name, m.email, {
        color: m.color,
        initials: m.initials,
        fields: [m.email],
      }),
    );
  }

  const groups: SearchGroup[] = [];
  for (const kind of GROUP_ORDER) {
    const results = byKind.get(kind);
    if (!results || results.length === 0) continue;
    results.sort((a, b) => b.score - a.score);
    groups.push({ kind, label: GROUP_LABEL[kind], results: results.slice(0, MAX_PER_GROUP) });
  }
  return groups;
}

/** Flatten grouped results into a single ordered list for arrow navigation. */
export function flattenGroups(groups: SearchGroup[]): SearchResult[] {
  return groups.flatMap((g) => g.results);
}

/** Re-export so consumers import space/doc types from one place if needed. */
export type { SpaceNode, DocNode };
