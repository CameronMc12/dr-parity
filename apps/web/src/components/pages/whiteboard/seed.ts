/**
 * First-mount board seeding. ClickUp's Whiteboard view opens on a *blank*
 * infinite canvas — no auto-placed task cards, no title text. We mirror that
 * exactly: the board starts empty and every element is created by the user via
 * the floating tool palette. Pure: no React, deterministic across remounts.
 */

import type { Task } from '@/store/workspace/types';
import type { WhiteboardElement } from './types';

/**
 * Build the initial element set for a freshly mounted board. The real ClickUp
 * whiteboard starts empty, so we seed nothing; args are kept for API stability
 * and possible future "import from list" affordance.
 */
export function buildSeed(
  _tasks: Task[],
  _listName: string,
): WhiteboardElement[] {
  return [];
}
