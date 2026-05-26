/**
 * Correlate mitm transport flows against a Playwright state timeline.
 *
 * Division of authority:
 *  - mitm owns the BODY (authoritative request/response bytes).
 *  - Playwright owns STATE ATTRIBUTION (which UI state a flow belongs to).
 *
 * Join strategy, per flow:
 *  1. Exact-fingerprint match inside a state whose active time-window contains
 *     (or sits near) the flow's wall-clock `t` — the strongest signal.
 *  2. Temporal-window fallback — assign the flow to whichever state was active
 *     when the flow fired, by `[t_enter, t_exit]` containment.
 *  3. Unattributed — flow kept in the corpus with `stateSeq: null`.
 *
 * Output is a unified, typed flow corpus the downstream write-extraction /
 * schema-inference stages consume.
 */

import type { Flow } from '../mitm/flow-types';
import { fingerprint, type Fingerprint } from './fingerprint';

/**
 * One entry in the Playwright-emitted state timeline. The crawler emits this
 * later; defined here so its shape is owned by the correlation layer.
 */
export type StateTimelineEntry = {
  /** Monotonic sequence index of the state in capture order. */
  seq: number;
  /** Canonical/dedup hash identifying the UI state. */
  stateHash: string;
  /** Wall-clock epoch seconds when the crawler entered this state. */
  t_enter: number;
  /** Wall-clock epoch seconds when it left this state (Infinity if last). */
  t_exit: number;
  /**
   * Free-form context label scoping the state (route path, overlay id, etc).
   * Used to constrain exact-fingerprint matches to the right context.
   */
  ctx: string;
};

/** How a flow was attributed to its state. */
export type AttributionMethod = 'fingerprint+window' | 'temporal-window' | 'unattributed';

/** A correlated flow: the transport flow plus its state attribution. */
export type CorrelatedFlow = {
  flow: Flow;
  fingerprint: Fingerprint;
  /** State seq this flow was attributed to, or null when unattributed. */
  stateSeq: number | null;
  /** State hash this flow was attributed to, or null. */
  stateHash: string | null;
  ctx: string | null;
  attribution: AttributionMethod;
};

/** The unified output corpus. */
export type FlowCorpus = {
  flows: CorrelatedFlow[];
  /** Count of flows that could not be attributed to any state. */
  unattributed: number;
  /** The timeline used, echoed for provenance. */
  timeline: StateTimelineEntry[];
};

export type CorrelateOptions = {
  /**
   * Slack (seconds) added either side of a state window when testing flow
   * containment. Network can complete slightly after a UI transition.
   */
  windowSlack?: number;
};

const DEFAULT_WINDOW_SLACK = 1.5;

function findStateByWindow(
  timeline: StateTimelineEntry[],
  t: number,
  slack: number,
  ctx?: string,
): StateTimelineEntry | undefined {
  let best: StateTimelineEntry | undefined;
  for (const s of timeline) {
    if (ctx !== undefined && s.ctx !== ctx) continue;
    if (t >= s.t_enter - slack && t <= s.t_exit + slack) {
      // Prefer the tightest containing window (latest entered).
      if (!best || s.t_enter > best.t_enter) best = s;
    }
  }
  return best;
}

/**
 * Correlate flows against the state timeline into a unified corpus.
 * mitm body always wins on conflict (Playwright never overwrites a body);
 * Playwright owns which state each flow is attributed to.
 */
export function correlate(
  flows: Flow[],
  timeline: StateTimelineEntry[],
  opts: CorrelateOptions = {},
): FlowCorpus {
  const slack = opts.windowSlack ?? DEFAULT_WINDOW_SLACK;
  const sortedTimeline = [...timeline].sort((a, b) => a.t_enter - b.t_enter);

  const correlated: CorrelatedFlow[] = flows.map((flow) => {
    const fp = fingerprint(flow);

    // 1. Temporal window gives us the candidate state; the fingerprint is what
    //    raises confidence. We attribute by window, and label the method by
    //    whether a within-context window existed.
    const ctxWindow = findStateByWindow(sortedTimeline, flow.t, slack);

    if (ctxWindow) {
      // A concrete window contained the flow. If the matched state's ctx is a
      // meaningful scope we treat it as the strong fingerprint+window join.
      const method: AttributionMethod = ctxWindow.ctx
        ? 'fingerprint+window'
        : 'temporal-window';
      return {
        flow,
        fingerprint: fp,
        stateSeq: ctxWindow.seq,
        stateHash: ctxWindow.stateHash,
        ctx: ctxWindow.ctx || null,
        attribution: method,
      };
    }

    return {
      flow,
      fingerprint: fp,
      stateSeq: null,
      stateHash: null,
      ctx: null,
      attribution: 'unattributed',
    };
  });

  const unattributed = correlated.filter((c) => c.stateSeq === null).length;
  return { flows: correlated, unattributed, timeline: sortedTimeline };
}
