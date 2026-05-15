/**
 * SPA pre-hydration auto-cleanup.
 *
 * Many single-page-app frameworks ship a CSS preamble that locks the page
 * (html/body fixed + overflow hidden, intro/preloader overlays at high
 * z-index, visually-hidden h1s) until JavaScript hydrates the app. When we
 * statically clone the page, JS never runs and those rules leave the user
 * staring at a blank or frozen viewport.
 *
 * This module:
 *   1. Detects common SPA framework markers (Nuxt, Vue SPA, React/Next,
 *      generic loaders).
 *   2. When detected, emits a `_spa-cleanup.css` file in the clone root that
 *      overrides the offending rules.
 *   3. Injects `<link rel="stylesheet" href="/_spa-cleanup.css">` as the
 *      LAST stylesheet in <head> so it wins the cascade.
 */

import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

export interface SpaDetection {
  detected: boolean;
  frameworks: string[];
  reasons: string[];
}

const SPA_CLEANUP_FILENAME = '_spa-cleanup.css';
const SPA_CLEANUP_HREF = '/_spa-cleanup.css';

/**
 * Inspect raw HTML and decide whether the captured page is a JS-locked SPA.
 * Returns a structured detection object so callers can log the reasons.
 */
export function detectSpa(html: string): SpaDetection {
  const frameworks = new Set<string>();
  const reasons: string[] = [];

  // Nuxt: <div id="__nuxt">, window.__NUXT__, _nuxt/ script paths.
  if (/id=["']__nuxt["']/i.test(html)) {
    frameworks.add('nuxt');
    reasons.push('found <div id="__nuxt">');
  }
  if (/window\.__NUXT__/.test(html)) {
    frameworks.add('nuxt');
    reasons.push('found window.__NUXT__ payload');
  }
  if (/[/"]_nuxt\//.test(html)) {
    frameworks.add('nuxt');
    reasons.push('found _nuxt/ asset path');
  }

  // Vue SPA: <div id="app" data-v-app>, __VUE_HMR_RUNTIME__.
  if (/id=["']app["'][^>]*\bdata-v-app\b/i.test(html)) {
    frameworks.add('vue');
    reasons.push('found <div id="app" data-v-app>');
  }
  if (/__VUE_HMR_RUNTIME__/.test(html)) {
    frameworks.add('vue');
    reasons.push('found __VUE_HMR_RUNTIME__');
  }

  // React / Next.js: <div id="__next">, __NEXT_DATA__, _next/ paths.
  if (/id=["']__next["']/i.test(html)) {
    frameworks.add('next');
    reasons.push('found <div id="__next">');
  }
  if (/__NEXT_DATA__/.test(html)) {
    frameworks.add('next');
    reasons.push('found __NEXT_DATA__ payload');
  }
  if (/[/"]_next\//.test(html)) {
    frameworks.add('next');
    reasons.push('found _next/ asset path');
  }

  // Generic SPA loader: any <style> block that locks html/body AND mentions
  // a preloader/intro/loader/[data-loading] selector with a high z-index.
  if (hasGenericLoader(html)) {
    frameworks.add('generic-loader');
    reasons.push('found html/body lock combined with preloader/intro/loader element');
  }

  return {
    detected: frameworks.size > 0,
    frameworks: Array.from(frameworks),
    reasons,
  };
}

function hasGenericLoader(html: string): boolean {
  const styleBlocks = html.match(/<style[\s\S]*?<\/style>/gi) ?? [];
  if (styleBlocks.length === 0) return false;

  const locksHtmlBody = styleBlocks.some((block) => {
    const lower = block.toLowerCase();
    const targetsHtmlOrBody = /\b(html|body)\b[^{]*\{[^}]*position\s*:\s*fixed/i.test(lower);
    const hidesOverflow = /\b(html|body)\b[^{]*\{[^}]*overflow\s*:\s*hidden/i.test(lower);
    return targetsHtmlOrBody && hidesOverflow;
  });
  if (!locksHtmlBody) return false;

  const loaderSelector = /\.(intro|preloader|loader)\b|\[data-loading\b/i.test(html);
  if (!loaderSelector) return false;

  const highZIndex = styleBlocks.some((block) =>
    /z-index\s*:\s*(?:9[0-9]|[1-9][0-9]{2,})/i.test(block),
  );
  return highZIndex;
}

/**
 * The cleanup stylesheet. Comment at the top documents what is stripped and
 * why. Kept as a single template literal so future detections can extend it.
 */
export function buildSpaCleanupCss(detection: SpaDetection): string {
  const header = [
    '/*',
    ' * dr-parity SPA pre-hydration cleanup',
    ' *',
    ' * Generated automatically because the captured page matched SPA markers:',
    ` *   frameworks: ${detection.frameworks.join(', ') || 'none'}`,
    ...detection.reasons.map((r) => ` *   - ${r}`),
    ' *',
    ' * Without these overrides the captured CSS keeps the page locked in its',
    ' * pre-hydration state: html/body pinned with position:fixed + overflow:hidden,',
    ' * an .intro/.preloader/.loader overlay sitting at a high z-index, and the',
    ' * primary h1 hidden as a 1x1 SEO label. The static clone has no JS to',
    ' * dismiss any of that, so we revert each rule below.',
    ' */',
    '',
  ].join('\n');

  const body = `
html, body {
  position: static !important;
  overflow: visible !important;
  inset: auto !important;
  height: auto !important;
  min-height: 100vh;
}

main {
  position: static !important;
  overflow: visible !important;
  inset: auto !important;
}

/* Revert "visually hidden" h1 clipping (1px width/height + overflow:hidden). */
h1 {
  position: static !important;
  height: auto !important;
  width: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  clip: auto !important;
  clip-path: none !important;
  border: 0 !important;
  white-space: normal !important;
}

/* Hide pre-hydration overlays that never animate away without JS. */
.intro,
.preloader,
.loader,
[data-loading] {
  display: none !important;
}

/* Reveal common SPA root containers. */
#__nuxt,
#__next,
#app,
.app {
  display: block !important;
  opacity: 1 !important;
  visibility: visible !important;
}

/* Inline "opacity: 0 until hydrated" — common Nuxt/Vue pattern. */
[style*="opacity: 0"][data-v],
[style*="opacity:0"][data-v] {
  opacity: 1 !important;
}
`.trimStart();

  return `${header}${body}`;
}

/**
 * Inject `<link rel="stylesheet" href="/_spa-cleanup.css">` as the LAST
 * stylesheet inside <head> so it overrides every captured rule. Returns the
 * modified HTML. If no <head> exists, one is created.
 */
export function injectSpaCleanupLink(html: string): string {
  const $ = cheerio.load(html, { xmlMode: false });

  let head = $('head');
  if (head.length === 0) {
    $('html').prepend('<head></head>');
    head = $('head');
  }

  // Append after the very last <link rel="stylesheet"> if present, else at
  // the end of <head>. Append-at-end works in both cases because cheerio
  // preserves insertion order.
  head.append(`<link rel="stylesheet" href="${SPA_CLEANUP_HREF}" data-dr-parity="spa-cleanup">`);

  return $.html();
}

export interface ApplySpaCleanupArgs {
  html: string;
  cloneRoot: string;
}

export interface ApplySpaCleanupResult {
  html: string;
  detection: SpaDetection;
  cssWritten: boolean;
  cssPath: string | null;
}

/**
 * High-level entry point: detect, write the CSS file when needed, and inject
 * the <link> tag into the HTML. Idempotent — safe to call once per page.
 */
export function applySpaCleanup(args: ApplySpaCleanupArgs): ApplySpaCleanupResult {
  const detection = detectSpa(args.html);
  if (!detection.detected) {
    return { html: args.html, detection, cssWritten: false, cssPath: null };
  }

  const cssPath = join(args.cloneRoot, SPA_CLEANUP_FILENAME);
  writeFileSync(cssPath, buildSpaCleanupCss(detection), 'utf8');

  const html = injectSpaCleanupLink(args.html);
  return { html, detection, cssWritten: true, cssPath };
}

export const SPA_CLEANUP_FILE = SPA_CLEANUP_FILENAME;
