/**
 * ARIA accessibility snapshot per state.
 *
 * A low-noise semantic signal for state identity and downstream parity. Prefers
 * the modern `locator.ariaSnapshot()` (a stable YAML-ish tree) and falls back to
 * the legacy `page.accessibility.snapshot()` JSON. Fully defensive: on any
 * failure it writes nothing and returns null so the crawler never throws.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';

type AriaResult = {
  /** Absolute path to the written snapshot file, or null if nothing captured. */
  ariaPath: string | null;
};

/**
 * Capture an ARIA snapshot of the current page and write it next to dom.html in
 * the given state directory. Returns the written path (relative-friendly) or
 * null when no snapshot could be produced.
 */
export async function captureAriaSnapshot(
  page: Page,
  stateDir: string,
): Promise<AriaResult> {
  // Preferred: ariaSnapshot() yields a compact, deterministic tree.
  try {
    const body = page.locator('body');
    const maybeAriaSnapshot = (body as unknown as {
      ariaSnapshot?: (opts?: unknown) => Promise<string>;
    }).ariaSnapshot;
    if (typeof maybeAriaSnapshot === 'function') {
      const yaml = await maybeAriaSnapshot.call(body);
      if (typeof yaml === 'string' && yaml.trim().length > 0) {
        const path = join(stateDir, 'aria.txt');
        writeFileSync(path, yaml, 'utf8');
        return { ariaPath: path };
      }
    }
  } catch {
    // fall through to legacy snapshot
  }

  // Fallback: the legacy `page.accessibility.snapshot()` tree as JSON. Removed
  // from the typed surface in recent Playwright, so reach it duck-typed and
  // guard on presence — older runtimes still expose it.
  try {
    const legacy = (page as unknown as {
      accessibility?: { snapshot?: () => Promise<unknown> };
    }).accessibility;
    if (legacy && typeof legacy.snapshot === 'function') {
      const tree = await legacy.snapshot();
      if (tree) {
        const path = join(stateDir, 'aria.json');
        writeFileSync(path, JSON.stringify(tree, null, 2), 'utf8');
        return { ariaPath: path };
      }
    }
  } catch {
    // best-effort
  }

  return { ariaPath: null };
}
