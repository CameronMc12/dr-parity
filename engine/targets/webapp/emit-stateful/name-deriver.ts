/**
 * Derive clean state variable names from trigger labels.
 *
 * "New Post" → `composeOpen` is unrealistic without a thesaurus; we settle
 * for a deterministic camelCase + kind suffix: "New Post" + modal →
 * `newPostModalOpen`. Always ends in `Open` for boolean clarity.
 */

import type { StateToggle, ToggleKind } from '../inference/types';

const RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
  'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new',
  'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
  'void', 'while', 'with', 'yield',
]);

function camelize(input: string): string {
  const cleaned = input
    .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
    .trim()
    .split(/[\s_-]+/)
    .filter((s) => s.length > 0);
  if (cleaned.length === 0) return '';
  const [first, ...rest] = cleaned;
  const head = first.toLowerCase();
  const tail = rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  return head + tail;
}

function kindSuffix(kind: ToggleKind): string {
  switch (kind) {
    case 'modal': return 'Modal';
    case 'dropdown': return 'Menu';
    case 'popover': return 'Popover';
    case 'drawer': return 'Drawer';
    case 'toast': return 'Toast';
    default: return 'Overlay';
  }
}

export interface ToggleNames {
  /** state var, e.g. `composeModalOpen` */
  stateVar: string;
  /** setter, e.g. `setComposeModalOpen` */
  setter: string;
  /** ref name for click-outside, e.g. `composeModalRef` */
  refName: string;
}

export function deriveToggleNames(
  toggle: StateToggle,
  usedNames: Set<string>,
): ToggleNames {
  const base = camelize(toggle.triggerLabel || toggle.kind || 'overlay') || 'overlay';
  let stem = base + kindSuffix(toggle.kind);
  if (RESERVED.has(stem)) stem = `${stem}_`;

  let candidate = `${stem}Open`;
  let i = 2;
  while (usedNames.has(candidate)) {
    candidate = `${stem}${i}Open`;
    i++;
  }
  usedNames.add(candidate);

  const setter = `set${candidate.charAt(0).toUpperCase()}${candidate.slice(1)}`;
  const refName = candidate.replace(/Open$/, 'Ref');

  return { stateVar: candidate, setter, refName };
}
