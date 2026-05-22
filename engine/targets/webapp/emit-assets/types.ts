/**
 * Types for the asset extraction + emit pipeline.
 *
 * The pipeline reads either a pre-built `assets.jsonl` index (from the crawler)
 * or falls back to extracting from Playwright's `trace.zip` archive. It then
 * mirrors first-party assets into the generated webapp's `public/` tree,
 * preserving original URL paths so CSS/font/image references resolve at runtime.
 */

export type AssetResourceType = 'stylesheet' | 'font' | 'image' | 'other';

export interface AssetRecord {
  url: string;
  resourceType: AssetResourceType;
  contentType: string;
  size: number;
  /** SHA1 keying into trace.zip's `resources/<sha1>` body store, when available. */
  sha1?: string;
  /**
   * Optional inline body. When present (e.g. embedded in `assets.jsonl`),
   * the pipeline writes this directly and skips the trace.zip lookup.
   * May be base64-encoded for binary payloads — see `bodyEncoding`.
   */
  body?: string;
  bodyEncoding?: 'utf8' | 'base64';
}

export interface AssetEmitSummary {
  copiedCount: number;
  cssCount: number;
  fontCount: number;
  imageCount: number;
  totalBytes: number;
  /** public-relative paths of CSS files, for index.html re-linking. */
  cssHrefs: string[];
  warnings: string[];
}

export interface EmitAssetsOptions {
  /**
   * First-party origin hostnames to mirror. URLs whose host does not match
   * any entry are skipped (third-party CDNs are not duplicated into public/).
   * When omitted, the host is inferred from the parent directory name of
   * `crawlDir` (the crawler convention is `<root>/<host>/<viewport>`).
   */
  originHosts?: string[];
  /**
   * When neither an inline body nor a trace.zip-backed sha1 is available,
   * fetch the asset over HTTP at emit time. Defaults to true — the current
   * crawler records URL + size only, so HTTP fetch is the primary body
   * source for fresh builds. Set to false in tests or air-gapped builds.
   */
  fetchMissingBodies?: boolean;
}
