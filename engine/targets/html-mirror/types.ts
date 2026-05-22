/**
 * Types for the static HTML mirror target.
 *
 * The mirror is a non-React, non-framework static snapshot of the captured
 * crawl. It exists so Cameron can evaluate the raw captured DOM (with CSS
 * intact) before any framework conversion runs.
 */

export interface BuildHtmlMirrorOptions {
  /** Path to the crawl directory (contains routes.json, routes/, assets.jsonl, trace.zip). */
  crawlDir: string;
  /** Output directory. Created if missing; existing dir is reused. */
  outDir: string;
  /** Originating host for the crawl (used for link/asset rewriting). */
  originHost?: string;
}

export interface RouteEmitResult {
  /** Source path (e.g. "/posts"). */
  path: string;
  /** Output file written (e.g. "<out>/posts/index.html"). */
  outFile: string;
  /** Title of the captured page. */
  title: string;
  /** Number of <script> tags removed. */
  scriptsStripped: number;
  /** Number of <a href> values rewritten. */
  linksRewritten: number;
  /** Number of asset src/href values rewritten. */
  assetsRewritten: number;
}

export interface HtmlMirrorSummary {
  outDir: string;
  routesEmitted: number;
  assetsCopied: number;
  assetsBytes: number;
  internalLinksRewritten: number;
  scriptsStripped: number;
  routes: RouteEmitResult[];
  warnings: string[];
}
