import type { PrimitiveConfig, PrimitiveMap, PrimitiveMapEntry } from './types';

export function buildPrimitiveMap(config: PrimitiveConfig): PrimitiveMap {
  const byClass: Record<string, PrimitiveMapEntry> = {};
  const byTag: Record<string, PrimitiveMapEntry> = {};

  const sortedNames = Object.keys(config.primitives).sort();

  for (const name of sortedNames) {
    const def = config.primitives[name];

    if (def.matchClasses) {
      for (const className of def.matchClasses) {
        if (!(className in byClass)) {
          byClass[className] = { primitive: name, variant: null, size: null };
        }
      }
    }

    if (def.variants) {
      for (const variantKey of Object.keys(def.variants)) {
        const cls = def.variants[variantKey];
        if (!(cls in byClass)) {
          byClass[cls] = { primitive: name, variant: variantKey, size: null };
        }
      }
    }

    if (def.sizes) {
      for (const sizeKey of Object.keys(def.sizes)) {
        const cls = def.sizes[sizeKey];
        if (!(cls in byClass)) {
          byClass[cls] = { primitive: name, variant: null, size: sizeKey };
        }
      }
    }

    if (def.matchTags) {
      for (const tag of def.matchTags) {
        if (!(tag in byTag)) {
          byTag[tag] = { primitive: name, variant: null, size: null };
        }
      }
    }
  }

  return {
    byClass: sortObjectKeys(byClass),
    byTag: sortObjectKeys(byTag),
  };
}

function sortObjectKeys<T>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = obj[k];
  }
  return out;
}
