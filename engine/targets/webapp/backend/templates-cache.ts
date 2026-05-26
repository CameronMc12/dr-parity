/**
 * Load the captured INTERNAL-shape skeletons (subcategory / genericView /
 * tasks-bulk / sidebar tree / project) ONCE at server startup and cache them in
 * memory. The crawl's network.jsonl is ~766MB, so streaming it per request would
 * be fatal; `extractTemplates` streams it line-by-line and stops early once all
 * skeletons are found, so a single warm-up pass at boot is cheap.
 *
 * The request handlers reuse these skeletons via the proven bridge mappers
 * (mapSubcategory / mapGenericView / mapTasksBulk) to overlay store rows onto the
 * structural shape the bundle expects.
 */

import { extractTemplates, type CapturedTemplates } from '../replay/bridge/extract-templates';

let cached: CapturedTemplates | null = null;

export async function loadTemplates(crawlDir: string): Promise<CapturedTemplates> {
  if (cached) return cached;
  cached = await extractTemplates(crawlDir);
  return cached;
}

export function getCachedTemplates(): CapturedTemplates | null {
  return cached;
}

export type { CapturedTemplates };
