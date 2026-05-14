import type { Element } from 'domhandler';

export type ProtectionCause = 'customElement' | 'dataAttr' | 'ancestor';

export interface ProtectionResult {
  protected: boolean;
  cause: ProtectionCause | null;
}

const ASTRO_CID_PREFIX = 'data-astro-cid';

function isCustomElementTag(tag: string): boolean {
  if (!tag) return false;
  const lower = tag.toLowerCase();
  if (lower.startsWith('!') || lower.startsWith('?')) return false;
  return lower.includes('-');
}

function isJsBindingDataAttr(name: string): boolean {
  const lower = name.toLowerCase();
  if (!lower.startsWith('data-')) return false;
  if (lower === ASTRO_CID_PREFIX) return false;
  if (lower.startsWith(`${ASTRO_CID_PREFIX}-`)) return false;
  return true;
}

function hasJsBindingDataAttr(el: Element): boolean {
  const attrs = el.attribs ?? {};
  for (const name of Object.keys(attrs)) {
    if (isJsBindingDataAttr(name)) return true;
  }
  return false;
}

export function evaluateProtection(
  el: Element,
  ancestorProtected: boolean,
): ProtectionResult {
  if (ancestorProtected) {
    return { protected: true, cause: 'ancestor' };
  }
  const tag = el.tagName ? el.tagName.toLowerCase() : '';
  if (isCustomElementTag(tag)) {
    return { protected: true, cause: 'customElement' };
  }
  if (hasJsBindingDataAttr(el)) {
    return { protected: true, cause: 'dataAttr' };
  }
  return { protected: false, cause: null };
}
