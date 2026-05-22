/**
 * Map a captured asset URL to a public/-relative path.
 *
 * Cross-origin assets (CDNs, third-party hosts) return null — we don't
 * mirror them into the generated webapp's public tree.
 */

export function urlToPublicPath(url: string, originHost?: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (originHost && parsed.hostname !== originHost) return null;

  // Strip any query/hash. Asset filenames in public/ are addressed by path only.
  const pathname = parsed.pathname;
  if (!pathname || pathname === '/') return null;

  // Ensure leading slash, no trailing slash.
  const normalised = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (normalised.endsWith('/')) return null;

  return normalised;
}

/**
 * Lightweight host-matching helper used by `emitAssets` when filtering
 * AssetRecord[] down to first-party URLs.
 */
export function isFirstPartyUrl(url: string, originHosts: readonly string[]): boolean {
  if (originHosts.length === 0) return true;
  try {
    const parsed = new URL(url);
    return originHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}
