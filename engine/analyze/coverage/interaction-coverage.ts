/**
 * Tally captured states by interaction type. The harness writes an interaction
 * label into each state's meta.json. The field name has varied across harness
 * versions, so several candidate fields are probed; older runs that only have
 * `sourceKind` (route/overlay) still classify, so the report degrades cleanly.
 *
 * Each raw label is normalised to one of five interaction classes. Any class
 * with zero captures is flagged as a coverage hole (the harness did not fire).
 */

import { INTERACTION_CLASSES } from './types.js';
import type {
  InteractionClass,
  InteractionCoverage,
} from './types.js';
import type { StateMeta } from './run-reader.js';

const LABEL_FIELDS = ['interaction', 'interactionLabel', 'label', 'action', 'trigger'] as const;

/** Pull the raw interaction label from a state meta, falling back to sourceKind. */
function rawLabel(meta: StateMeta): string {
  for (const field of LABEL_FIELDS) {
    const v = meta[field];
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase();
  }
  if (typeof meta.sourceKind === 'string' && meta.sourceKind.trim()) {
    return meta.sourceKind.trim().toLowerCase();
  }
  return 'unknown';
}

/** Map a raw label to one of the five interaction classes, or null. */
export function classifyLabel(label: string): InteractionClass | null {
  if (label === 'right-click' || label.startsWith('right-click') || label.includes('context')) {
    return 'contextmenu';
  }
  if (label.startsWith('hover')) return 'hover';
  if (label.startsWith('dnd')) return 'dnd';
  if (label.startsWith('kbd') || label.startsWith('hotkey') || label === 'slash-menu' || label.startsWith('slash')) {
    return 'keyboard';
  }
  if (label === 'click' || label.startsWith('click')) return 'click';
  return null;
}

function emptyClassTally(): Record<InteractionClass, number> {
  return { click: 0, contextmenu: 0, hover: 0, keyboard: 0, dnd: 0 };
}

export function computeInteractionCoverage(metas: StateMeta[]): InteractionCoverage {
  const byLabel: Record<string, number> = {};
  const byClass = emptyClassTally();
  const unclassified: Record<string, number> = {};

  for (const meta of metas) {
    const label = rawLabel(meta);
    byLabel[label] = (byLabel[label] ?? 0) + 1;
    const cls = classifyLabel(label);
    if (cls) byClass[cls] += 1;
    else unclassified[label] = (unclassified[label] ?? 0) + 1;
  }

  const emptyClasses = INTERACTION_CLASSES.filter((c) => byClass[c] === 0);

  return {
    byLabel,
    byClass,
    emptyClasses,
    totalStates: metas.length,
    unclassified,
  };
}
