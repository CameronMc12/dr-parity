/**
 * Emit a per-route CONTENT component for the shell/content split.
 *
 * Each content component embeds only that route's content region (the inner
 * HTML of the detected outlet) verbatim via dangerouslySetInnerHTML, then wires
 * the route's inferred overlay toggles using the same trigger/close marker
 * machinery as emit-stateful. It is rendered inside the layout's <Outlet/>, so
 * the shell (sidebar/topbar) is NOT duplicated here — only the route body.
 *
 * Trigger selectors are matched within the content subtree (cheerio), so any
 * toggle whose trigger lives in the shell (e.g. a global search button) simply
 * goes unmatched here and is governed by the layout's interaction layer
 * instead. This keeps content components free of shell chrome.
 */

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import type { RouteGroup, StateToggle } from '../inference/types';
import { deriveComponentName } from '../route-naming';
import { deriveToggleNames, type ToggleNames } from '../emit-stateful/name-deriver';
import { emitStateHooks } from '../emit-stateful/state-hooks';
import { emitDismissEffects } from '../emit-stateful/dismiss-effects';
import { buildVerbatimOverlays } from '../emit-stateful/verbatim-body';
import {
  TRIGGER_MARKER_ATTR,
  type OverlayWiring,
  type TriggerWiring,
} from '../emit-stateful/verbatim-body';
import { emitVerbatimComponentShell } from '../emit-stateful/component-shell-verbatim';

function buildPairs(toggles: StateToggle[]): { toggle: StateToggle; names: ToggleNames }[] {
  const used = new Set<string>();
  return toggles.map((toggle) => ({ toggle, names: deriveToggleNames(toggle, used) }));
}

function safeSelector(selector: string): string | null {
  const trimmed = selector.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('text=') || trimmed.includes(':contains(')) return null;
  return trimmed;
}

/**
 * Mark trigger elements that exist inside the content subtree. Scripts are
 * already stripped from the content HTML by buildContentHtml, so this only adds
 * `data-dr-parity-trigger` markers and returns the wiring for matched triggers.
 */
function markContentTriggers(
  contentHtml: string,
  pairs: { toggle: StateToggle; names: ToggleNames }[],
): { bodyHtml: string; triggers: TriggerWiring[]; unmatched: string[] } {
  const $ = cheerio.load(contentHtml, null, false);
  const triggers: TriggerWiring[] = [];
  const unmatched: string[] = [];

  pairs.forEach(({ toggle, names }, idx) => {
    const sel = safeSelector(toggle.triggerSelector);
    if (!sel) {
      unmatched.push(toggle.triggerSelector);
      return;
    }
    let target: any;
    try {
      target = $(sel).first();
    } catch {
      unmatched.push(toggle.triggerSelector);
      return;
    }
    if (!target || target.length === 0) {
      unmatched.push(toggle.triggerSelector);
      return;
    }
    const markerId = String(idx);
    target.attr(TRIGGER_MARKER_ATTR, markerId);
    triggers.push({ markerId, setter: names.setter });
  });

  return { bodyHtml: $.html(), triggers, unmatched };
}

export interface ContentEmitResult {
  componentName: string;
  tsx: string;
  unmatchedTriggers: string[];
}

export function emitContentComponent(args: {
  route: RouteGroup;
  contentHtml: string;
}): ContentEmitResult {
  const { route, contentHtml } = args;
  const componentName = `${deriveComponentName(route.routePath)}Content`;

  const pairs = buildPairs(route.baseStateGroup.toggles);
  const marked = markContentTriggers(contentHtml, pairs);

  // Only emit overlays whose trigger matched inside the content. Overlays whose
  // trigger lives in the shell stay out of the content component.
  const matchedSetters = new Set(marked.triggers.map((t) => t.setter));
  const matchedPairs = pairs.filter((p) => matchedSetters.has(p.names.setter));

  const hooks = emitStateHooks(matchedPairs);
  const effects = emitDismissEffects(matchedPairs);
  const overlays: OverlayWiring[] = buildVerbatimOverlays(matchedPairs);

  const tsx = emitVerbatimComponentShell({
    componentName,
    stateHookLines: hooks.lines,
    effectLines: effects.lines,
    effectImportNames: effects.importNames,
    bodyHtml: marked.bodyHtml,
    triggers: marked.triggers,
    overlays,
  });

  return { componentName, tsx, unmatchedTriggers: marked.unmatched };
}
