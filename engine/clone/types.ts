/**
 * Shared types for the clone pipeline.
 */

export type ParsedIndexEntry = {
  url: string;
  status: number;
  size: number;
  mimeType: string;
  file: string;
};

export type AssetBucket = 'styles' | 'scripts' | 'assets';

export type UrlMapEntry = {
  bucket: AssetBucket | 'document';
  /** Absolute source file path on disk (the parsed file). */
  sourceFile: string;
  /** Path relative to clone/ root (e.g. "styles/abc12345.css"). */
  cloneRelPath: string;
  /** Mime type from the parsed index. */
  mimeType: string;
};

export type UrlMap = Map<string, UrlMapEntry>;

export type CloneStats = {
  viewport: string;
  htmlBytes: number;
  styles: number;
  scripts: number;
  assets: number;
  unresolvedExternal: number;
  unresolvedSample: string[];
};

export type CloneManifest = CloneStats & {
  documentUrl: string;
  generatedAt: string;
};

export type ViewportCloneResult =
  | { ok: true; stats: CloneStats; viewport: string }
  | { ok: false; viewport: string; error: string };
