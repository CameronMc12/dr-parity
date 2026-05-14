export interface PrimitiveMapEntry {
  primitive: string;
  variant: string | null;
  size: string | null;
}

export interface PrimitiveMap {
  byClass: Record<string, PrimitiveMapEntry>;
  byTag: Record<string, PrimitiveMapEntry>;
}

export interface DomSwapEntry {
  originalOuterHTML: string;
  hash: string;
  pascalName: string;
}

export type DomSwapMap = DomSwapEntry[];

export interface NormalisedSwapEntry extends DomSwapEntry {
  normalisedKey: string;
}

export interface RefactorOptions {
  componentsDir: string;
  primitiveMapPath: string;
  iconSwapMapPath: string;
  iconImportBase: string;
  primitiveImportBase: string;
  prettify: boolean;
  force: boolean;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface ProtectionCounters {
  protectedElements: number;
  protectedByCause: {
    customElement: number;
    dataAttr: number;
    ancestor: number;
  };
  wouldHaveSwapped: number;
}

export interface RefactorReport {
  filesScanned: number;
  filesRefactored: number;
  filesSkipped: SkippedFile[];
  primitivesUsed: Record<string, number>;
  iconsUsed: Record<string, number>;
  classSwapsBySection: Record<string, number>;
  iconSwapsBySection: Record<string, number>;
  protection: ProtectionCounters;
}

export interface SectionRefactorResult {
  filePath: string;
  changed: boolean;
  primitivesUsed: Set<string>;
  iconsUsed: Set<string>;
  classSwaps: number;
  iconSwaps: number;
  protection: ProtectionCounters;
  reason?: string;
}

export interface FrontmatterSplit {
  frontmatter: string | null;
  body: string;
}
