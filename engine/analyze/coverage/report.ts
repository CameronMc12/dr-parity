/**
 * Top-level coverage orchestration: load the surface map, read the run, compute
 * endpoint / route / interaction coverage, and write the report bundle.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeEndpointCoverage } from './endpoint-coverage.js';
import { computeRouteCoverage } from './route-coverage.js';
import { computeInteractionCoverage } from './interaction-coverage.js';
import {
  inspectInputs,
  readGraphUrls,
  readNetwork,
  readStateMetas,
} from './run-reader.js';
import {
  renderDashboardMd,
  renderEndpointMd,
  renderInteractionMd,
  renderRouteMd,
} from './markdown.js';
import type {
  CoverageReport,
  SurfaceEndpoints,
  SurfaceRoutes,
} from './types.js';

const SURFACE_DIR = 'docs/research/clickup-parity/surface-map';

function loadJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`required surface-map file missing: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export async function generateCoverage(
  repoRoot: string,
  runDir: string,
): Promise<{ report: CoverageReport; outDir: string }> {
  const surfaceEndpoints = loadJson<SurfaceEndpoints>(
    join(repoRoot, SURFACE_DIR, 'endpoints.json'),
  );
  const surfaceRoutes = loadJson<SurfaceRoutes>(join(repoRoot, SURFACE_DIR, 'routes.json'));

  const inputs = inspectInputs(runDir);
  const { requests } = await readNetwork(runDir);
  const graphUrls = readGraphUrls(runDir);
  const metas = readStateMetas(runDir);

  const documentRequests = requests.filter((r) => r.resourceType === 'document');

  const endpoint = computeEndpointCoverage(surfaceEndpoints, requests);
  const route = computeRouteCoverage(
    surfaceRoutes.observedRoutes ?? [],
    graphUrls,
    documentRequests,
  );
  const interaction = computeInteractionCoverage(metas);

  const report: CoverageReport = {
    runDir,
    generatedAt: new Date().toISOString(),
    missingInputs: inputs.missing,
    endpoint,
    route,
    interaction,
  };

  const outDir = join(runDir, 'coverage');
  mkdirSync(outDir, { recursive: true });

  const write = (name: string, data: string) => writeFileSync(join(outDir, name), data);

  write('endpoint-coverage.json', JSON.stringify(endpoint, null, 2));
  write('endpoint-coverage.md', renderEndpointMd(endpoint));
  write('route-coverage.json', JSON.stringify(route, null, 2));
  write('route-coverage.md', renderRouteMd(route));
  write('interaction-coverage.json', JSON.stringify(interaction, null, 2));
  write('interaction-coverage.md', renderInteractionMd(interaction));
  write('COVERAGE.md', renderDashboardMd(report));

  return { report, outDir };
}
