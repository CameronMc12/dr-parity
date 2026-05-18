/**
 * Astro-target types. Re-exports the shared IR types so call sites that
 * historically imported `ComponentDef` / `ExtractedHead` from `engine/astro/types`
 * keep working through `engine/targets/astro/types`.
 */

export type {
  ComponentDef,
  ComponentRole,
  ExtractedHead,
  SliceResult,
} from '../shared/types';

export interface BuildOptions {
  cloneDir: string;
  outDir: string;
  name: string;
  force: boolean;
}

export interface BuildSummary {
  components: Array<{ name: string; bytes: number }>;
  assetCount: number;
  assetBytes: number;
}
