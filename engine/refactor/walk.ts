import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;
import type { CheerioAPI } from 'cheerio';
import type { Element, AnyNode } from 'domhandler';
import { rewritePlaceholders } from './post-process';
import { evaluateProtection } from './protection';
import { trySwapIcon } from './swap-icons';
import { trySwapPrimitive } from './swap-primitives';
import type {
  NormalisedSwapEntry,
  PrimitiveMap,
  ProtectionCounters,
} from './types';

export interface WalkResult {
  html: string;
  primitivesUsed: Set<string>;
  iconsUsed: Set<string>;
  classSwaps: number;
  iconSwaps: number;
  protection: ProtectionCounters;
}

interface Counters {
  primitives: Set<string>;
  icons: Set<string>;
  classSwaps: number;
  iconSwaps: number;
  protection: ProtectionCounters;
}

function isElement(node: AnyNode): node is Element {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

function emptyProtection(): ProtectionCounters {
  return {
    protectedElements: 0,
    protectedByCause: { customElement: 0, dataAttr: 0, ancestor: 0 },
    wouldHaveSwapped: 0,
  };
}

function walkChildrenFirst(
  $: CheerioAPI,
  el: Element,
  primitiveMap: PrimitiveMap,
  iconIndex: NormalisedSwapEntry[],
  counters: Counters,
  ancestorProtected: boolean,
): void {
  const protection = evaluateProtection(el, ancestorProtected);
  const selfProtected = protection.protected;

  if (selfProtected && protection.cause) {
    counters.protection.protectedElements += 1;
    counters.protection.protectedByCause[protection.cause] += 1;
  }

  const childNodes = [...(el.children ?? [])];
  for (const child of childNodes) {
    if (!isElement(child)) continue;
    walkChildrenFirst($, child, primitiveMap, iconIndex, counters, selfProtected);
  }

  if (el.parent === null) return;

  if (el.tagName && el.tagName.toLowerCase() === 'svg') {
    const iconResult = trySwapIcon($, el, iconIndex, selfProtected);
    if (iconResult.blockedByProtection) {
      counters.protection.wouldHaveSwapped += 1;
      return;
    }
    if (iconResult.swapped && iconResult.iconName) {
      counters.icons.add(iconResult.iconName);
      counters.iconSwaps += 1;
      return;
    }
  }

  const primResult = trySwapPrimitive($, el, primitiveMap, selfProtected);
  if (primResult.blockedByProtection) {
    counters.protection.wouldHaveSwapped += 1;
    return;
  }
  if (primResult.swapped && primResult.primitiveName) {
    counters.primitives.add(primResult.primitiveName);
    counters.classSwaps += 1;
  }
}

export function refactorBody(
  body: string,
  primitiveMap: PrimitiveMap,
  iconIndex: NormalisedSwapEntry[],
): WalkResult {
  const $ = cheerio.load(`<root>${body}</root>`, { xml: false }, false);
  const root = $('root').get(0);
  const counters: Counters = {
    primitives: new Set<string>(),
    icons: new Set<string>(),
    classSwaps: 0,
    iconSwaps: 0,
    protection: emptyProtection(),
  };

  if (root && isElement(root)) {
    const topLevel = [...(root.children ?? [])];
    for (const child of topLevel) {
      if (!isElement(child)) continue;
      walkChildrenFirst($, child, primitiveMap, iconIndex, counters, false);
    }
  }

  const rawOut = $('root').html() ?? '';
  const out = rewritePlaceholders(rawOut);

  return {
    html: out,
    primitivesUsed: counters.primitives,
    iconsUsed: counters.icons,
    classSwaps: counters.classSwaps,
    iconSwaps: counters.iconSwaps,
    protection: counters.protection,
  };
}
