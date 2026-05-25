/**
 * Phase 4 entrypoint. Loads the crawl directory's captured traffic,
 * groups it into endpoints, emits per-endpoint fixtures, and assembles
 * `src/mocks/handlers.ts`. The caller is responsible for writing the
 * returned files into the scaffolded webapp project.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { loadNetworkRecords } from './parse-network';
import { groupByEndpoint } from './group-endpoints';
import { buildFixtures } from './build-fixtures';
import { buildHandlersFile, buildEmptyHandlersFile } from './build-handlers';
import { redactString, redactSecrets } from '../redact';
import type { EmitMocksResult, FixtureFile, RequestRecord } from './types';

export type { RequestRecord, EndpointGroup, GeneratedHandler, EmitMocksResult, FixtureFile } from './types';
export { loadNetworkRecords } from './parse-network';
export { groupByEndpoint } from './group-endpoints';
export { inferUrlPattern } from './url-pattern';
export { buildFixtures, slugifyPath, fixtureImportName, normalizeRequestBody } from './build-fixtures';
export { buildBranchingHandler } from './branch-by-body';
export { buildHandlersFile, buildEmptyHandlersFile } from './build-handlers';

function redactRecord(rec: RequestRecord): RequestRecord {
  return {
    ...rec,
    requestBody: rec.requestBody != null ? redactString(rec.requestBody) : rec.requestBody,
    responseBody: rec.responseBody != null ? redactString(rec.responseBody) : rec.responseBody,
    responseHeaders: redactSecrets(rec.responseHeaders),
  };
}

export async function emitMocks(
  crawlDir: string,
  outDir: string,
): Promise<EmitMocksResult> {
  const { records: rawRecords, warnings } = await loadNetworkRecords(crawlDir);
  const records = rawRecords.map(redactRecord);

  if (records.length === 0) {
    const handlersTs = buildEmptyHandlersFile();
    writeOutputs(outDir, handlersTs, []);
    return {
      handlersTs,
      fixtures: [],
      warnings,
      endpointCount: 0,
      fixtureCount: 0,
    };
  }

  const groups = groupByEndpoint(records);
  const allFixtures: FixtureFile[] = [];
  const handlerInputs: { group: typeof groups[number]; refs: ReturnType<typeof buildFixtures>['refs'] }[] = [];

  for (const group of groups) {
    const { files, refs } = buildFixtures(group);
    allFixtures.push(...files);
    handlerInputs.push({ group, refs });
  }

  const handlersTs = buildHandlersFile(handlerInputs);

  writeOutputs(outDir, handlersTs, allFixtures);

  return {
    handlersTs,
    fixtures: allFixtures,
    warnings,
    endpointCount: groups.length,
    fixtureCount: allFixtures.length,
  };
}

function writeOutputs(outDir: string, handlersTs: string, fixtures: FixtureFile[]): void {
  const handlersPath = join(outDir, 'src', 'mocks', 'handlers.ts');
  mkdirSync(dirname(handlersPath), { recursive: true });
  writeFileSync(handlersPath, handlersTs, 'utf8');

  for (const fixture of fixtures) {
    const abs = join(outDir, fixture.relativePath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, fixture.content, 'utf8');
  }
}
