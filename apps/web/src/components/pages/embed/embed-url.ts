/**
 * URL handling for the Embed view. Normalises raw input into a safe, framable
 * http(s) URL and exposes a display form for the slim URL bar.
 */

export interface NormalizedUrl {
  /** Fully-qualified, validated http(s) URL ready for the iframe `src`. */
  href: string;
  /** Compact host + path shown in the URL bar. */
  display: string;
}

/**
 * Validate + normalise a user-entered embed URL.
 *
 * - Trims whitespace.
 * - Adds an `https://` scheme when the user omits it.
 * - Rejects anything that isn't an absolute http(s) URL.
 *
 * Returns `null` for empty or non-http(s) input so the caller can show an error.
 */
export function normalizeEmbedUrl(raw: string): NormalizedUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname.includes('.')) return null;

  return { href: parsed.href, display: toDisplay(parsed) };
}

function toDisplay(url: URL): string {
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname === '/' ? '' : url.pathname;
  return `${host}${path}${url.search}`;
}
