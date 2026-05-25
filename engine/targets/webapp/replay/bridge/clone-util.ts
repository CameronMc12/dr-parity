/**
 * Small helpers shared by the bridge mappers: deep clone, and recursive string
 * token substitution. Cloning the captured internal-shape template and swapping
 * the captured list/task ids for export ids keeps every structural and default
 * field the bundle expects, which is far safer than rebuilding the shape.
 */

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Recursively replace every occurrence of each `from` token with its `to`
 * value inside all string values of a JSON-cloneable object. Used to retarget a
 * cloned template from the captured list id to a generated list id (and to swap
 * captured status-group tokens). Operates on a fresh clone; never mutates input.
 */
export function substituteTokens<T>(value: T, replacements: Map<string, string>): T {
  if (replacements.size === 0) return deepClone(value);
  const pairs = Array.from(replacements.entries());

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      let out = node;
      for (const [from, to] of pairs) {
        if (out.includes(from)) out = out.split(from).join(to);
      }
      return out;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        result[k] = walk(v);
      }
      return result;
    }
    return node;
  };

  return walk(deepClone(value)) as T;
}
