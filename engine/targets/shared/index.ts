/**
 * Target-agnostic primitives shared across framework targets.
 */

export type { ComponentDef, ComponentRole, ExtractedHead, SliceResult } from './types';
export { normaliseUrl, normaliseSrcset, normaliseCssUrls, normaliseElementPaths } from './paths';
export { deriveSlug, pascalCase } from './slug';
export { extractHead } from './extract-head';
export { sliceBody } from './slice-body';
export type { SliceBodyResult } from './slice-body';
export { copyAssetsToPublic, dirSizeBytes } from './asset-copy';
export type { AssetCopyStats } from './asset-copy';
