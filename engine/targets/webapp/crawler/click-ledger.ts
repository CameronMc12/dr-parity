/**
 * Per-state clicked-element ledger.
 *
 * Prevents the crawler from re-clicking the same element on the same DOM state.
 * Each element is keyed by a signature built from its selector + role + a hash
 * of its text. The ledger is scoped to a state hash so the SAME control on a
 * DIFFERENT state can still be explored.
 */

import { createHash } from 'node:crypto';

export type ClickSignatureInput = {
  selector: string;
  role: string | null;
  text: string;
};

function textHash(text: string): string {
  return createHash('sha1')
    .update(text.replace(/\s+/g, ' ').trim().toLowerCase())
    .digest('hex')
    .slice(0, 8);
}

export function clickSignature(input: ClickSignatureInput): string {
  return `${input.selector}|${input.role ?? ''}|${textHash(input.text)}`;
}

export function createClickLedger() {
  const byState = new Map<string, Set<string>>();

  return {
    /** Returns true if this element was already clicked on this state. */
    seen(stateHash: string, signature: string): boolean {
      return byState.get(stateHash)?.has(signature) ?? false;
    },
    mark(stateHash: string, signature: string): void {
      const set = byState.get(stateHash) ?? new Set<string>();
      set.add(signature);
      byState.set(stateHash, set);
    },
  };
}

export type ClickLedger = ReturnType<typeof createClickLedger>;
