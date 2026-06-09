import { readFileSync } from 'node:fs';
import type { CapturedResponse, MockDb } from './types.js';
import { readResponses } from './net-reader.js';
import { extractHierarchy } from './extract-hierarchy.js';
import { extractTasks } from './extract-tasks.js';
import {
  extractComments,
  extractCustomFields,
  extractDocs,
  extractGoals,
  extractTags,
} from './extract-ancillary.js';
import { buildEndpointMap } from './endpoint-map.js';
import { buildCoverage, buildReadme, type CoverageResult } from './reports.js';
import type { SeedManifest } from './fixture-fallback.js';

export interface BuildResult {
  db: MockDb;
  endpointMap: ReturnType<typeof buildEndpointMap>['map'];
  coverage: CoverageResult;
  gapCount: number;
  readme: string;
  capturedCount: number;
}

export async function buildMockDb(opts: {
  runDirs: string[];
  manifestPath: string;
  endpointsPath: string;
}): Promise<BuildResult> {
  const manifest = JSON.parse(readFileSync(opts.manifestPath, 'utf8')) as SeedManifest;

  // merge responses from all supplied runs (later runs do not overwrite richer earlier data;
  // each extractor picks the richest record itself)
  const responses: CapturedResponse[] = [];
  for (const dir of opts.runDirs) {
    const label = dir.split('/').filter(Boolean).pop() ?? dir;
    const lines = await readResponses(`${dir}/network.jsonl`, label);
    responses.push(...lines);
  }

  const hierarchy = extractHierarchy(responses, manifest);
  const { tasks, foundIds, fixtureIds } = extractTasks(
    responses,
    manifest,
    hierarchy.statuses,
    hierarchy.users,
  );

  // wire taskIds onto their lists
  for (const t of Object.values(tasks)) {
    if (t.listId && hierarchy.lists[t.listId]) {
      hierarchy.lists[t.listId].taskIds.push(t.id);
    }
  }

  const tags = extractTags(responses, manifest.spaceId);
  const customFields = extractCustomFields(responses);
  const comments = extractComments(responses, tasks);
  const goals = extractGoals(responses, manifest);
  const { docs, pages } = extractDocs(manifest);

  const db: MockDb = {
    meta: {
      generatedAt: new Date().toISOString(),
      teamId: manifest.teamId,
      spaceId: manifest.spaceId,
      sourceRuns: opts.runDirs,
      marker: manifest.marker,
    },
    workspace: hierarchy.workspace,
    users: hierarchy.users,
    spaces: hierarchy.spaces,
    folders: hierarchy.folders,
    lists: hierarchy.lists,
    statuses: hierarchy.statuses,
    tasks,
    customFields,
    tags,
    comments,
    goals,
    docs,
    pages,
  };

  const { map, gaps } = buildEndpointMap(opts.endpointsPath, responses);
  const coverage = buildCoverage(db, manifest, gaps);
  const readme = buildReadme(db);

  // attach derived flags for the caller's report
  void foundIds;
  void fixtureIds;

  return {
    db,
    endpointMap: map,
    coverage,
    gapCount: gaps.length,
    readme,
    capturedCount: responses.length,
  };
}
