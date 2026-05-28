/**
 * View-template emitter.
 *
 * Given the Map produced by `inferViewTemplates`, writes a single JSON file
 * at `<cloneOutputDir>/replay/view-templates.json`. The file is consumed by
 * the Service Worker at runtime to synthesise viz/v1/view responses for
 * viewIds the crawl never captured.
 *
 * Schema:
 *   {
 *     "<viewType>": {
 *       template:       <full captured response body>,
 *       exampleViewId:  "<viewId used as replacement source>",
 *       viewType:       "<integer as string>",
 *       capturedFields: ["date_created", "type", ...],
 *       sourceFile:     "<path to network.jsonl>"
 *     },
 *     ...
 *   }
 *
 * Pure write — no side effects beyond the single output file.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { ViewTemplate } from './view-template-inference';

/**
 * Emit `replay/view-templates.json` into `cloneOutputDir`.
 *
 * No-op (silent) when `templates` is empty.
 */
export function emitViewTemplates(
  templates: Map<string, ViewTemplate>,
  cloneOutputDir: string,
): void {
  if (templates.size === 0) return;

  const record: Record<string, ViewTemplate> = {};
  for (const [typeKey, tmpl] of templates) {
    record[typeKey] = tmpl;
  }

  const outPath = join(cloneOutputDir, 'replay', 'view-templates.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(record, null, 2), 'utf8');
}
