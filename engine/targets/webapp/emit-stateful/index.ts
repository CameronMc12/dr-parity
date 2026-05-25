/**
 * Top-level entrypoint for stateful component emission.
 *
 * Given a RouteGroup (one base state + N overlay toggles), emit a single
 * React TSX page component file with working useState/useEffect wiring.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { RouteGroup, StateToggle } from '../inference/types';
import { deriveComponentName } from '../route-naming';

import { deriveToggleNames, type ToggleNames } from './name-deriver';
import { emitStateHooks } from './state-hooks';
import { emitDismissEffects } from './dismiss-effects';
import { buildVerbatimBody, buildVerbatimOverlays } from './verbatim-body';
import { emitVerbatimComponentShell } from './component-shell-verbatim';

export { deriveToggleNames } from './name-deriver';
export { emitStateHooks } from './state-hooks';
export { emitDismissEffects } from './dismiss-effects';
export { injectTriggerHandlers } from './inject-handlers';
export { emitOverlayBlocks } from './overlay-render';
export { emitComponentShell } from './component-shell';
export { buildVerbatimBody, buildVerbatimOverlays } from './verbatim-body';
export { emitVerbatimComponentShell } from './component-shell-verbatim';

export interface StatefulEmitInput {
  route: RouteGroup;
  baseHtml: string;
  /** Optional override for the component name (defaults to route-derived). */
  componentName?: string;
}

export interface StatefulEmitResult {
  componentName: string;
  tsx: string;
  unmatchedTriggers: string[];
}

function buildPairs(toggles: StateToggle[]): { toggle: StateToggle; names: ToggleNames }[] {
  const used = new Set<string>();
  return toggles.map((toggle) => ({
    toggle,
    names: deriveToggleNames(toggle, used),
  }));
}

export function emitStatefulComponent(input: StatefulEmitInput): StatefulEmitResult {
  const { route, baseHtml } = input;
  const componentName = input.componentName ?? deriveComponentName(route.routePath);

  const pairs = buildPairs(route.baseStateGroup.toggles);

  // WEBAPP fidelity: the body and overlays are embedded VERBATIM via
  // dangerouslySetInnerHTML rather than converted through htmlToJsx. htmlToJsx
  // camelCases / hyphen-strips attribute names, which breaks framework-scoped
  // CSS (Angular ViewEncapsulation.Emulated `[_ngcontent-ng-c*]` selectors)
  // and leaves the clone unstyled. Verbatim embedding preserves every
  // attribute exactly as captured. Trigger / close-button interactions are
  // wired post-mount via marker attributes instead of JSX onClick handlers.
  const hooks = emitStateHooks(pairs);
  const effects = emitDismissEffects(pairs);
  const verbatim = buildVerbatimBody(baseHtml, pairs);
  const overlays = buildVerbatimOverlays(pairs);

  const tsx = emitVerbatimComponentShell({
    componentName,
    stateHookLines: hooks.lines,
    effectLines: effects.lines,
    effectImportNames: effects.importNames,
    bodyHtml: verbatim.bodyHtml,
    triggers: verbatim.triggers,
    overlays,
  });

  return {
    componentName,
    tsx,
    unmatchedTriggers: verbatim.unmatched,
  };
}

export function writeStatefulPage(
  pagesDir: string,
  result: StatefulEmitResult,
): { name: string; bytes: number } {
  const filePath = join(pagesDir, `${result.componentName}.tsx`);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, result.tsx, 'utf8');
  return { name: result.componentName, bytes: Buffer.byteLength(result.tsx, 'utf8') };
}
