/**
 * Infer an MSW-compatible URL pattern from a set of captured URLs that hit
 * the same endpoint. Segments that vary across captures and look like IDs
 * are replaced with `:paramN`. Static-looking segments stay verbatim.
 */

const UUID_LIKE = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const HEX_ID = /^[0-9a-f]{8,}$/i;
const ALL_DIGITS = /^[0-9]+$/;

export type UrlPattern = {
  pathPattern: string;
  origin: string;
};

function looksLikeId(segment: string): boolean {
  if (ALL_DIGITS.test(segment)) return true;
  if (UUID_LIKE.test(segment)) return true;
  if (HEX_ID.test(segment)) return true;
  return false;
}

function safeParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function inferUrlPattern(urls: string[]): UrlPattern {
  if (urls.length === 0) {
    return { pathPattern: '/', origin: '' };
  }

  const parsed = urls.map(safeParse).filter((u): u is URL => u !== null);
  if (parsed.length === 0) {
    return { pathPattern: urls[0], origin: '' };
  }

  const origin = parsed[0].origin;

  const segmentLists = parsed.map((u) => u.pathname.split('/').filter((s) => s.length > 0));

  if (segmentLists.length === 1) {
    return { pathPattern: parsed[0].pathname || '/', origin };
  }

  // All paths must have the same segment count for templating to make
  // sense; if they differ, fall back to the first path verbatim.
  const segCount = segmentLists[0].length;
  if (!segmentLists.every((segs) => segs.length === segCount)) {
    return { pathPattern: parsed[0].pathname || '/', origin };
  }

  const merged: string[] = [];
  let paramIndex = 0;
  for (let i = 0; i < segCount; i++) {
    const values = new Set<string>();
    for (const segs of segmentLists) values.add(segs[i]);
    if (values.size === 1) {
      merged.push(segmentLists[0][i]);
      continue;
    }
    // Varies. Only collapse to a param if every value looks like an id.
    const allIdLike = Array.from(values).every(looksLikeId);
    if (allIdLike) {
      merged.push(`:param${paramIndex++}`);
    } else {
      // Different non-id segments — different endpoints. Keep the first.
      merged.push(segmentLists[0][i]);
    }
  }

  const pathPattern = '/' + merged.join('/');
  return { pathPattern: pathPattern === '/' ? '/' : pathPattern, origin };
}
