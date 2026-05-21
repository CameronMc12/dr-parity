/**
 * Destructive-action detection. We default to safe: anything that smells like
 * delete / logout / payment is skipped. Callers may extend via --blocklist.
 */

export const ALWAYS_BLOCKED_TEXT: readonly string[] = [
  'delete',
  'remove',
  'log out',
  'logout',
  'sign out',
  'cancel subscription',
  'cancel plan',
  'unsubscribe',
  'disconnect',
  'revoke',
  'archive',
  'trash',
  'clear all',
  'reset',
  'confirm payment',
  'purchase',
  'pay',
  'send',
];

export type BlocklistInput = {
  text: string | null;
  ariaLabel: string | null;
  className: string | null;
  type: string | null;
  insideForm: boolean;
  ancestorClasses: string[];
};

const DANGER_CLASS_RE = /\b(destructive|danger|delete|trash)\b/i;

export function isBlocked(input: BlocklistInput, extraPatterns: string[]): boolean {
  const text = (input.text ?? '').toLowerCase().trim();
  const aria = (input.ariaLabel ?? '').toLowerCase().trim();
  const haystacks = [text, aria].filter(Boolean);

  for (const phrase of ALWAYS_BLOCKED_TEXT) {
    for (const h of haystacks) {
      if (h.includes(phrase)) return true;
    }
  }
  for (const phrase of extraPatterns) {
    const lower = phrase.toLowerCase().trim();
    if (!lower) continue;
    for (const h of haystacks) {
      if (h.includes(lower)) return true;
    }
  }

  if (input.className && DANGER_CLASS_RE.test(input.className)) return true;
  for (const c of input.ancestorClasses) {
    if (DANGER_CLASS_RE.test(c)) return true;
  }

  if (input.type === 'submit' && input.insideForm) return true;

  return false;
}
