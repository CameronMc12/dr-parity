/**
 * Emit `useState` + `useRef` declarations for a route's toggles.
 */

import type { StateToggle } from '../inference/types';
import type { ToggleNames } from './name-deriver';

export interface HooksBlock {
  /** lines emitted inside the component body */
  lines: string[];
  /** which React hooks need importing */
  importNames: Set<string>;
}

export function emitStateHooks(
  pairs: { toggle: StateToggle; names: ToggleNames }[],
): HooksBlock {
  const lines: string[] = [];
  const importNames = new Set<string>(['useState']);

  for (const { toggle, names } of pairs) {
    lines.push(`  const [${names.stateVar}, ${names.setter}] = useState(false);`);
    if (toggle.dismissStrategy === 'click-outside' || toggle.dismissStrategy === 'unknown') {
      lines.push(`  const ${names.refName} = useRef<HTMLDivElement | null>(null);`);
      importNames.add('useRef');
    }
  }

  return { lines, importNames };
}
