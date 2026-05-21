/**
 * Emit `useEffect` blocks that wire keyboard-Escape and click-outside
 * dismissal to setter(false) for each toggle.
 *
 * For dismissStrategy 'unknown' we emit BOTH escape + click-outside as a
 * safety net, with a TODO comment so a human can refine later.
 */

import type { StateToggle } from '../inference/types';
import type { ToggleNames } from './name-deriver';

export interface EffectsBlock {
  lines: string[];
  importNames: Set<string>;
}

function emitEscapeEffect(stateVar: string, setter: string): string {
  return [
    `  useEffect(() => {`,
    `    if (!${stateVar}) return;`,
    `    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') ${setter}(false); };`,
    `    window.addEventListener('keydown', handler);`,
    `    return () => window.removeEventListener('keydown', handler);`,
    `  }, [${stateVar}]);`,
  ].join('\n');
}

function emitClickOutsideEffect(
  stateVar: string,
  setter: string,
  refName: string,
): string {
  return [
    `  useEffect(() => {`,
    `    if (!${stateVar}) return;`,
    `    const handler = (e: MouseEvent) => {`,
    `      if (${refName}.current && !${refName}.current.contains(e.target as Node)) ${setter}(false);`,
    `    };`,
    `    document.addEventListener('mousedown', handler);`,
    `    return () => document.removeEventListener('mousedown', handler);`,
    `  }, [${stateVar}]);`,
  ].join('\n');
}

export function emitDismissEffects(
  pairs: { toggle: StateToggle; names: ToggleNames }[],
): EffectsBlock {
  const lines: string[] = [];
  const importNames = new Set<string>();

  for (const { toggle, names } of pairs) {
    const { stateVar, setter, refName } = names;
    const strat = toggle.dismissStrategy;

    if (strat === 'escape' || strat === 'unknown') {
      lines.push(emitEscapeEffect(stateVar, setter));
      importNames.add('useEffect');
    }
    if (strat === 'click-outside' || strat === 'unknown') {
      lines.push(emitClickOutsideEffect(stateVar, setter, refName));
      importNames.add('useEffect');
    }
    if (strat === 'unknown') {
      lines.push(`  // TODO: dismiss strategy unknown for ${stateVar} — escape + click-outside both wired.`);
    }
  }

  return { lines, importNames };
}
