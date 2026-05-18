/**
 * React-target types. Re-exports the shared IR types and adds the
 * React-specific extension that carries the converted `.tsx` body.
 */

export type {
  ComponentDef,
  ComponentRole,
  ExtractedHead,
  SliceResult,
} from '../shared/types';

import type { ComponentDef } from '../shared/types';

/**
 * A component definition after HTML-to-JSX conversion. The `tsx` field
 * holds the JSX fragment body (no `export function` wrapper); `emit.ts`
 * wraps it in the function component template.
 */
export interface ReactComponentDef extends ComponentDef {
  /** JSX body, ready to be wrapped in a function component. */
  tsx: string;
  /** Names of child components that this component renders (Main wraps sections). */
  childImports?: string[];
}

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
