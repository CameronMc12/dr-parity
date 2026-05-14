export interface PrimitiveDef {
  tag: string;
  matchClasses?: string[];
  matchTags?: string[];
  variants?: Record<string, string>;
  sizes?: Record<string, string>;
  passThroughClasses?: boolean;
}

export interface PrimitiveConfig {
  primitives: Record<string, PrimitiveDef>;
}

export interface ClassCatalogEntryLite {
  className: string;
  count: number;
}

export interface PrimitiveMapEntry {
  primitive: string;
  variant: string | null;
  size: string | null;
}

export interface PrimitiveMap {
  byClass: Record<string, PrimitiveMapEntry>;
  byTag: Record<string, PrimitiveMapEntry>;
}

export interface EmittedPrimitive {
  name: string;
  file: string;
  baseClass: string | null;
  variantKeys: string[];
  sizeKeys: string[];
  matchClasses: string[];
  matchTags: string[];
}

export interface ClassCoverage {
  className: string;
  primitive: string;
  occurrencesInCatalog: number;
}

export interface ExtractionResult {
  emitted: EmittedPrimitive[];
  coverage: ClassCoverage[];
  warnings: string[];
  outDir: string;
  configPath: string;
  indexFile: string;
  mapFile: string;
}
