/**
 * Shared context the crawler hands to each extended interaction harness
 * (keyboard / DnD / hover). The harnesses NEVER touch state-capture.ts or
 * state-dump.ts directly — they go through `captureLabelled`, which wraps the
 * crawler's existing dedup'd `captureCurrent` + edge-creation so every harness
 * state lands on the SAME capture path (dom.html + screenshot + state.json) and
 * shares the visited / canonical-key dedup set.
 */

import type { Page } from 'playwright';
import type { Interaction, StateNode } from './types';
import type { Throttle } from './interaction-throttle';

/**
 * Capture the page's CURRENT DOM as a (possibly new) state and, if it is new and
 * distinct from `fromNode`, record an edge from `fromNode` describing how the
 * harness reached it. Returns the captured node (existing or fresh) or null when
 * capture was deduped to nothing new. Implemented by the crawler over its
 * canonical-key-deduped `captureCurrent`.
 */
export type CaptureLabelled = (args: {
  fromNode: StateNode;
  depth: number;
  interaction: Interaction;
}) => Promise<StateNode | null>;

export type HarnessContext = {
  page: Page;
  throttle: Throttle;
  /** Reached-state limit guard. True => stop, the crawl is at capacity. */
  isAtCapacity: () => boolean;
  capture: CaptureLabelled;
  /** Best-effort restore to the clean route base between harness probes. */
  restore: () => Promise<void>;
  /** Detected runtime signatures (e.g. 'dnd-kit', 'react-beautiful-dnd'). */
  signatures: () => string[];
  /** Structured non-fatal note (drift caveats, skips) for the run log. */
  note: (msg: string) => void;
};
