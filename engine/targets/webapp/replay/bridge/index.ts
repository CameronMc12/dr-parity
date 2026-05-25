/**
 * Bridge barrel: generate INTERNAL-shape replay recordings for every list/space
 * in a ClickUp export, so the replay renders lists the crawl never captured.
 */

export { generateBridgeRecordings } from './generate-from-export';
export type { BridgeResult, BridgeIndex } from './generate-from-export';
export { extractTemplates } from './extract-templates';
export type { CapturedTemplates } from './extract-templates';
export { loadExport } from './load-export';
export type { ExportData } from './load-export';
