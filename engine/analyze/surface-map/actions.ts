/**
 * Extract NgRx action-type string literals from minified bundles.
 * ClickUp uses Angular + NgRx, so action types follow the
 * "[Source] Event description" convention.
 */

import { readFileSync } from 'node:fs';
import type { ActionGroup } from './types.js';

// "[Source] Event" — quoted with backtick, double, or single quote.
// Source: starts uppercase, allows words/spaces/_-. Event: at least one word.
const ACTION_RE = /[`"']\[([A-Z][A-Za-z0-9 _.-]{1,48})\]\s+([A-Z][A-Za-z0-9 _.()/-]{2,80})[`"']/g;

/** Strings that match the shape but are log messages / format strings. */
function isNoise(source: string, event: string): boolean {
  const s = source.toLowerCase();
  if (s === 'deprecated' || s === 'object' || s === 'array') return true;
  // Template-literal fragments leak a trailing backtick into the capture.
  if (event.includes('`')) return true;
  // Sentence-style log messages tend to contain lowercase connector words.
  if (/\b(invalid|not expected|property|default to|cannot|failed to)\b/i.test(event)) {
    return true;
  }
  return false;
}

export function extractActions(bundleFiles: string[]): ActionGroup[] {
  const byNamespace = new Map<string, Set<string>>();

  for (const file of bundleFiles) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    let m: RegExpExecArray | null;
    ACTION_RE.lastIndex = 0;
    while ((m = ACTION_RE.exec(text)) !== null) {
      const source = m[1].trim();
      const event = m[2].trim();
      if (isNoise(source, event)) continue;
      const full = `[${source}] ${event}`;
      let set = byNamespace.get(source);
      if (!set) {
        set = new Set();
        byNamespace.set(source, set);
      }
      set.add(full);
    }
  }

  const groups: ActionGroup[] = [];
  for (const [namespace, set] of byNamespace) {
    groups.push({
      namespace,
      count: set.size,
      actions: [...set].sort(),
    });
  }
  groups.sort((a, b) =>
    b.count === a.count ? a.namespace.localeCompare(b.namespace) : b.count - a.count,
  );
  return groups;
}

export function countActions(groups: ActionGroup[]): number {
  return groups.reduce((n, g) => n + g.count, 0);
}
