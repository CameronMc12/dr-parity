/**
 * ClickUp webapp profile.
 *
 * Activates the hybrid route discoverer for any ClickUp host. The hybrid
 * discoverer reads previously-captured `network.jsonl` files (passed in via
 * `DiscoveryContext.networkLogPaths`) and synthesises `/v/<typeCode>/<viewId>`
 * URLs from the workspace's view-enumeration API responses.
 *
 * Background: see `docs/V2.0/08-clickup-failure-attribution.md` for the
 * diagnostic that justifies this profile (≥85% of in-app views are gated
 * behind API responses the crawler never parsed).
 */

import { createHybridRouteDiscoverer } from '../crawler/discovery/hybrid-route-discoverer';
import type { WebappProfile } from './types';

export const clickupProfile: WebappProfile = {
  name: 'clickup',
  hostMatchers: [/app\.clickup\.com$/, /clickup\.com$/],
  discoverers: [createHybridRouteDiscoverer()],
  // Previously-captured ClickUp network logs. The crawler expands the glob
  // once at init and hands the concrete file list to the hybrid discoverer so
  // it has a real corpus to mine before the in-flight crawl has produced any
  // bytes of its own.
  bootstrapCorpus: ['docs/research/crawl/app.clickup.com/*/network.jsonl'],
  // Additive. When replay is built for a ClickUp crawl, infer one view
  // template per viewType from the previously-captured network logs and emit
  // replay/view-templates.json. The SW uses these to synthesise
  // GET /viz/v1/view/<id> responses for uncaptured views at runtime.
  viewSynth: {
    enabled: true,
    templatePaths: ['docs/research/crawl/app.clickup.com/*/network.jsonl'],
  },
  // Additive. The captured doc-pages export carries plain Markdown content
  // per (docId, pageId). The replay build emits a compact lookup index and
  // inlines the doc-freezer shim so /v/dc/<id> routes paint the editor with
  // real content instead of hanging on the Codox WebSocket.
  docFreeze: {
    enabled: true,
    pagesIndexPath: 'docs/research/clickup-export/2026-05-25T16-21-00-615Z/doc-pages.json',
  },
};
