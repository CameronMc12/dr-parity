const MAX_ARRAY_SAMPLE = 1;
const MAX_STRING_LEN = 120;
const MAX_DEPTH = 4;

/**
 * Produce a trimmed, structure-only sample of an API response.
 * Arrays keep the first element only (with a truncation marker).
 * Long strings are clipped. Depth is bounded. Safe to commit — never
 * contains full bodies.
 */
export function trimSample(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) return "…[depth-truncated]";

  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const head = value.slice(0, MAX_ARRAY_SAMPLE).map((v) => trimSample(v, depth + 1));
    if (value.length > MAX_ARRAY_SAMPLE) {
      head.push(`…[+${value.length - MAX_ARRAY_SAMPLE} more]`);
    }
    return head;
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = trimSample(v, depth + 1);
    }
    return out;
  }

  if (typeof value === "string" && value.length > MAX_STRING_LEN) {
    return `${value.slice(0, MAX_STRING_LEN)}…[clipped]`;
  }

  return value;
}
