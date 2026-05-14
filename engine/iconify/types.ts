export interface CapturedSvg {
  outerHTML: string;
  innerHTML: string;
  attributes: Record<string, string>;
  ariaLabel: string | null;
  dataIcon: string | null;
  dataName: string | null;
  firstClass: string | null;
  parentClass: string | null;
  parentSelector: string;
}

export interface NormalisedSvg extends CapturedSvg {
  normalisedHTML: string;
  hash: string;
}

export interface IconGroup {
  hash: string;
  pascalName: string;
  kebabName: string;
  representative: NormalisedSvg;
  occurrences: NormalisedSvg[];
}

export interface IconManifestEntry {
  name: string;
  pascalName: string;
  hash: string;
  componentFile: string;
  occurrences: number;
  contexts: string[];
}

export interface IconManifest {
  icons: IconManifestEntry[];
  total: number;
  unique: number;
}

export interface DomSwapEntry {
  originalOuterHTML: string;
  hash: string;
  pascalName: string;
}

export type DomSwapMap = DomSwapEntry[];

export interface IconifyOptions {
  cloneDir: string;
  outDir: string;
  force: boolean;
}

export interface IconifyResult {
  total: number;
  unique: number;
  manifestPath: string;
  swapMapPath: string;
  outDir: string;
}
