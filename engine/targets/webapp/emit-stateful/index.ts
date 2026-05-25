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
import { injectTriggerHandlers } from './inject-handlers';
import { emitOverlayBlocks } from './overlay-render';
import { emitComponentShell } from './component-shell';

export { deriveToggleNames } from './name-deriver';
export { emitStateHooks } from './state-hooks';
export { emitDismissEffects } from './dismiss-effects';
export { injectTriggerHandlers } from './inject-handlers';
export { emitOverlayBlocks } from './overlay-render';
export { emitComponentShell } from './component-shell';

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

  const hooks = emitStateHooks(pairs);
  const effects = emitDismissEffects(pairs);
  const injected = injectTriggerHandlers(baseHtml, pairs);
  const overlays = emitOverlayBlocks(pairs);

  const reactHookImports = new Set<string>([...hooks.importNames, ...effects.importNames]);

  const tsx = emitComponentShell({
    componentName,
    reactHookImports,
    stateHookLines: hooks.lines,
    effectLines: effects.lines,
    baseJsx: injected.jsx,
    overlayLines: overlays.lines,
  });

  return {
    componentName,
    tsx,
    unmatchedTriggers: injected.unmatched,
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
