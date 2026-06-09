import type { MockDb, SurfaceEndpoint } from './types.js';
import type { SeedManifest } from './fixture-fallback.js';

function countBySource<T extends { _source: string }>(rec: Record<string, T>): {
  total: number;
  captured: number;
  fixture: number;
} {
  const vals = Object.values(rec);
  return {
    total: vals.length,
    captured: vals.filter((v) => v._source === 'captured').length,
    fixture: vals.filter((v) => v._source === 'fixture').length,
  };
}

export interface CoverageResult {
  markdown: string;
  entityCounts: Record<string, number>;
  seedFound: string[];
  seedMissing: string[];
}

export function buildCoverage(
  db: MockDb,
  manifest: SeedManifest,
  gaps: SurfaceEndpoint[],
): CoverageResult {
  const collections: Array<[string, Record<string, { _source: string }>]> = [
    ['users', db.users],
    ['spaces', db.spaces],
    ['folders', db.folders],
    ['lists', db.lists],
    ['statuses', db.statuses],
    ['tasks', db.tasks],
    ['customFields', db.customFields],
    ['tags', db.tags],
    ['comments', db.comments],
    ['goals', db.goals],
    ['docs', db.docs],
    ['pages', db.pages],
  ];

  const lines: string[] = ['# Mock DB Coverage', '', `Generated: ${db.meta.generatedAt}`, ''];
  lines.push('## Entity counts', '', '| Entity | Total | Captured | Fixture-filled |', '| --- | --- | --- | --- |');
  const entityCounts: Record<string, number> = {};
  for (const [name, rec] of collections) {
    const c = countBySource(rec);
    entityCounts[name] = c.total;
    lines.push(`| ${name} | ${c.total} | ${c.captured} | ${c.fixture} |`);
  }
  lines.push('', `Workspace: ${db.workspace ? `\`${db.workspace.id}\` (${db.workspace._source})` : 'MISSING'}`, '');

  // seed-manifest id presence
  const allEntities = new Set<string>([
    ...Object.keys(db.spaces),
    ...Object.keys(db.folders),
    ...Object.keys(db.lists),
    ...Object.keys(db.tasks),
    ...Object.keys(db.goals),
    ...Object.keys(db.docs),
    ...Object.keys(db.pages),
  ]);
  const capturedIds = new Set<string>([
    ...Object.entries(db.tasks).filter(([, t]) => t._source === 'captured').map(([k]) => k),
    ...Object.keys(db.spaces),
    ...Object.keys(db.folders),
    ...Object.keys(db.lists),
  ]);

  const seedFound: string[] = [];
  const seedMissing: string[] = [];
  lines.push('## Seed-manifest ids', '', '| Key | Id | In mock-db | Real captured |', '| --- | --- | --- | --- |');
  for (const [key, id] of Object.entries(manifest.ids)) {
    const present = allEntities.has(id);
    const realCaptured = capturedIds.has(id);
    if (present) seedFound.push(key);
    else seedMissing.push(key);
    lines.push(`| ${key} | \`${id}\` | ${present ? 'yes' : 'NO'} | ${realCaptured ? 'yes' : 'fixture/none'} |`);
  }
  lines.push('');

  // endpoint gaps
  lines.push('## Endpoint data gaps (no captured response)', '', `${gaps.length} endpoints had no captured example.`, '');
  const byService = new Map<string, number>();
  for (const g of gaps) byService.set(g.service, (byService.get(g.service) ?? 0) + 1);
  lines.push('| Service | Gap count |', '| --- | --- |');
  for (const [svc, n] of [...byService.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${svc} | ${n} |`);
  }
  lines.push('');

  return { markdown: lines.join('\n'), entityCounts, seedFound, seedMissing };
}

export function buildReadme(db: MockDb): string {
  return [
    '# ClickUp Seed Mock DB',
    '',
    'Normalized data foundation for the DR-PARITY-SEED ClickUp React clone, derived',
    'from REAL captured network responses (with seed-fixture fallback for fields the',
    'captures never carried).',
    '',
    '## Files',
    '',
    '- `mock-db.json` — normalized, id-keyed collections (the store seed).',
    '- `endpoint-map.json` — captured example response per surface-map endpoint, grouped by service, for a replay mock service.',
    '- `coverage.md` — entity counts + seed-id presence + endpoint gaps.',
    '',
    '## mock-db.json shape',
    '',
    '```ts',
    'interface MockDb {',
    '  meta: { generatedAt; teamId; spaceId; sourceRuns; marker };',
    '  workspace: MockWorkspace | null;',
    '  users:        Record<id, MockUser>;',
    '  spaces:       Record<id, MockSpace>;       // folderIds, folderlessListIds, statusIds',
    '  folders:      Record<id, MockFolder>;      // listIds',
    '  lists:        Record<id, MockList>;        // taskIds, statusIds',
    '  statuses:     Record<id, MockStatus>;',
    '  tasks:        Record<id, MockTask>;        // listId, statusId, priority, assigneeIds,',
    '                                             //   tagNames, dates, checklists, customFieldValues,',
    '                                             //   subtaskIds, dependsOnIds, commentCount',
    '  customFields: Record<id, MockCustomField>;',
    '  tags:         Record<name, MockTag>;',
    '  comments:     Record<id, MockComment>;     // taskId',
    '  goals:        Record<id, MockGoal>;',
    '  docs:         Record<id, MockDoc>;         // pageIds',
    '  pages:        Record<id, MockDocPage>;     // docId, content',
    '}',
    '```',
    '',
    'Every entity carries `_source: "captured" | "fixture"` so the store can show',
    'which values are real vs synthesised.',
    '',
    '## Relationships',
    '',
    '- workspace → spaces → (folders | folderlessLists) → lists → tasks',
    '- task.subtaskIds → tasks, task.dependsOnIds → tasks',
    '- task.statusId → statuses, task.assigneeIds → users, task.tagNames → tags',
    '- doc.pageIds → pages',
    '',
    '## How to consume',
    '',
    'Import `mock-db.json` into the Redux store as the initial normalized state.',
    'Use `endpoint-map.json` in a mock service worker / fetch shim: match the',
    'incoming request path against each entry\'s `pathTemplate` and return',
    '`example`. Entries with `hasCapturedResponse: false` need a hand-written stub.',
    '',
    `Counts at generation time: ${Object.keys(db.tasks).length} tasks, ` +
      `${Object.keys(db.lists).length} lists, ${Object.keys(db.comments).length} comments.`,
    '',
  ].join('\n');
}
