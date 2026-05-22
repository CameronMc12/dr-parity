/**
 * Strip captured build-system runtime tags from HTML before it reaches
 * the JSX converter or the Vite index shell.
 *
 * The crawler captures the original document verbatim, which includes
 * `<script src="/assets/index-XXX.js">` and `<link rel="stylesheet"
 * href="/assets/...">` references emitted by the source site's bundler.
 * Replaying those in the cloned project causes 404s because we don't
 * ship the original `/assets/*` artefacts under those exact hashed names.
 *
 * Also strips third-party tracking scripts (Meta Pixel, GA, Stripe.js,
 * reCAPTCHA, Hotjar, etc.) since they throw runtime errors in a cloned
 * environment with no real customer-id wiring and pollute the console.
 *
 * Anything we still need (favicons, manifests, inline `<style>` blocks,
 * arbitrary `<link rel>` we haven't blacklisted) is preserved.
 */

import * as cheerioModule from 'cheerio';

const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

const ASSETS_PATH_RE = /(^|\/)assets\//i;

const RUNTIME_LINK_RELS = new Set(['preload', 'modulepreload']);

/**
 * Tracking / third-party SDK script hosts whose presence in the clone
 * causes runtime errors or noisy console output. Matched against script
 * `src` URLs.
 */
const TRACKING_SCRIPT_HOST_PATTERNS: readonly RegExp[] = [
  /connect\.facebook\.net/i,
  /\bfbevents\b/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /gtag\b/i,
  /\bgstatic\.com\/recaptcha/i,
  /\bgoogle\.com\/recaptcha/i,
  /js\.stripe\.com/i,
  /www\.clarity\.ms/i,
  /\bposthog\b/i,
  /cdn\.amplitude\.com/i,
  /cdn\.segment\.com/i,
  /widget\.intercom\.io/i,
  /static\.hotjar\.com/i,
  /static\.cloudflareinsights\.com/i,
];

/**
 * Inline script content patterns that indicate a captured tracking-pixel
 * boot block (Meta Pixel, GA, etc.). Matched against the inline text.
 */
const TRACKING_INLINE_PATTERNS: readonly RegExp[] = [
  /\bfbq\s*\(/,
  /\b_fbq\b/,
  /__fbeventsModules/,
  /\bgtag\s*\(/,
  /\b_gaq\b/,
  /googletagmanager/i,
  /connect\.facebook\.net/i,
  /clarity\.ms/i,
  /window\.posthog\b/,
  /amplitude\.getInstance/i,
  /window\.analytics\b/,
  /window\.Intercom\b/,
  /hj\(\s*['"]/,
];

function isRuntimeAssetUrl(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('/assets/')) return true;
  // absolute URLs with /assets/ anywhere in the pathname
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      return ASSETS_PATH_RE.test(u.pathname);
    } catch {
      return ASSETS_PATH_RE.test(trimmed);
    }
  }
  return false;
}

function isTrackingScriptSrc(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return TRACKING_SCRIPT_HOST_PATTERNS.some((re) => re.test(trimmed));
}

function isTrackingInline(content: string | undefined): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (trimmed.length === 0) return false;
  return TRACKING_INLINE_PATTERNS.some((re) => re.test(trimmed));
}

function shouldStripScript(el: any, $: any): boolean {
  const src = $(el).attr('src');
  const type = ($(el).attr('type') ?? '').toLowerCase();

  if (src && isRuntimeAssetUrl(src)) return true;
  // ES module loader scripts emitted by bundlers
  if (type === 'module' && src && src.length > 0) return true;
  // Third-party tracking / analytics SDKs
  if (src && isTrackingScriptSrc(src)) return true;
  // Inline tracking boot blocks (Meta Pixel, GA gtag, etc.)
  if (!src && isTrackingInline($(el).html())) return true;

  return false;
}

function shouldStripLink(el: any, $: any): boolean {
  const href = $(el).attr('href');
  const rel = ($(el).attr('rel') ?? '').toLowerCase().trim();

  if (href && isRuntimeAssetUrl(href)) return true;
  if (rel && RUNTIME_LINK_RELS.has(rel)) return true;
  // preconnect / dns-prefetch to tracking hosts is dead weight in a clone
  if (
    href &&
    (rel === 'preconnect' || rel === 'dns-prefetch') &&
    isTrackingScriptSrc(href)
  ) {
    return true;
  }

  return false;
}

function shouldStripNoscript(el: any, $: any): boolean {
  // Strip <noscript> blocks that exist solely to host a tracking-pixel
  // <img>. They're harmless in a real browser (noscript never runs) but
  // they pollute the captured-head text with facebook.com/tr URLs and
  // similar that show up in code review.
  const inner = $(el).html() ?? '';
  if (inner.length === 0) return false;
  return /facebook\.com\/tr\b|google-analytics\.com|googletagmanager\.com|clarity\.ms/i.test(
    inner,
  );
}

/**
 * Remove build-system runtime asset tags from an HTML fragment.
 * Safe to call on either a full document, the head innerHTML, or a
 * body slice — cheerio loads the fragment in non-document mode.
 */
export function stripRuntimeTags(html: string): string {
  if (!html || html.length === 0) return html;

  const $ = cheerio.load(html, null, false);

  $('script').each((_i: number, el: any) => {
    if (shouldStripScript(el, $)) $(el).remove();
  });

  $('link').each((_i: number, el: any) => {
    if (shouldStripLink(el, $)) $(el).remove();
  });

  $('noscript').each((_i: number, el: any) => {
    if (shouldStripNoscript(el, $)) $(el).remove();
  });

  return $.html();
}
