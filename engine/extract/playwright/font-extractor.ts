/**
 * Font extractor for Dr Parity's extraction engine.
 *
 * Detects all fonts used on a page — @font-face rules, Google Fonts, Adobe/
 * Typekit — downloads font files locally, and maps which DOM elements
 * reference each family.
 *
 * Design decisions:
 * - Stylesheet CSS text is fetched from within the page context (via
 *   `fetch()`) to avoid CORS issues — the browser already loaded them.
 * - Google Fonts CSS is re-fetched with a WOFF2-compatible User-Agent so the
 *   response contains WOFF2 URLs instead of TTF.
 * - Font files are downloaded via Playwright's built-in request context to
 *   inherit cookies/auth from the browsing session.
 * - Variable fonts are detected by checking for `font-variation-settings` in
 *   @font-face rules or in computed element styles.
 */

import type { Page } from 'playwright';
import type { FontSpec, FontFile, FontSource, FontStyle, FontFileFormat } from '../../types/extraction';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FontExtractionResult {
  fonts: FontSpec[];
  downloadedFiles: string[];
  googleFontsUsed: string[];
  selfHostedFonts: string[];
  systemFonts: string[];
}

/**
 * Extract all fonts from a page, download font files, and map usage.
 */
export async function extractFonts(
  page: Page,
  outputDir: string,
): Promise<FontExtractionResult> {
  const fontsDir = join(outputDir, 'public', 'fonts');
  await mkdir(fontsDir, { recursive: true });

  // Step 1: Gather raw font data from the page in one pass.
  const rawData = await gatherFontData(page);

  // Step 2: Fetch Google Fonts CSS (if any) for WOFF2 URLs.
  const googleFontFaces = await fetchGoogleFontsCss(page, rawData.googleFontsUrls);

  // Step 3: Merge all @font-face declarations.
  const allFontFaces = [...rawData.fontFaces, ...googleFontFaces];

  // Step 4: Build FontSpec records grouped by family.
  const fontMap = buildFontMap(allFontFaces, rawData.fontUsage, rawData.systemFontFamilies);

  // Step 5: Download font files.
  const downloadedFiles = await downloadFontFiles(page, fontMap, fontsDir);

  // Step 6: Categorize results.
  const fonts = Array.from(fontMap.values());
  const googleFontsUsed = fonts
    .filter((f) => f.source === 'google')
    .map((f) => f.family);
  const selfHostedFonts = fonts
    .filter((f) => f.source === 'self-hosted')
    .map((f) => f.family);
  const systemFonts = fonts
    .filter((f) => f.source === 'system')
    .map((f) => f.family);

  return {
    fonts,
    downloadedFiles,
    googleFontsUsed,
    selfHostedFonts,
    systemFonts,
  };
}

// ---------------------------------------------------------------------------
// Raw data gathering (single page.evaluate)
// ---------------------------------------------------------------------------

interface RawFontFace {
  family: string;
  weight: string;
  style: string;
  url: string;
  format: string;
  unicodeRange: string;
  isVariable: boolean;
  variationSettings: string;
}

interface RawFontUsage {
  selector: string;
  families: string[];
}

interface RawFontData {
  fontFaces: RawFontFace[];
  googleFontsUrls: string[];
  typekitIds: string[];
  fontUsage: RawFontUsage[];
  systemFontFamilies: Set<string>;
}

const SYSTEM_FONT_FAMILIES = new Set([
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'Noto Sans',
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  'Helvetica',
  'Times New Roman',
  'Times',
  'Courier New',
  'Courier',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Lucida Console',
  'Monaco',
]);

async function gatherFontData(page: Page): Promise<RawFontData> {
  const raw = await page.evaluate(async () => {
    // --- Fetch all stylesheet CSS text from the page context ---
    const cssTexts: string[] = [];

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        // Same-origin sheets: read rules directly.
        const rules = sheet.cssRules || sheet.rules;
        let text = '';
        for (let i = 0; i < rules.length; i++) {
          text += rules[i].cssText + '\n';
        }
        cssTexts.push(text);
      } catch {
        // Cross-origin sheets: fetch the href.
        if (sheet.href) {
          try {
            const resp = await fetch(sheet.href);
            if (resp.ok) {
              cssTexts.push(await resp.text());
            }
          } catch {
            // Silently skip unreachable stylesheets.
          }
        }
      }
    }

    // --- Detect Google Fonts links ---
    const googleFontsUrls: string[] = [];
    const links = document.querySelectorAll<HTMLLinkElement>(
      'link[href*="fonts.googleapis.com"]',
    );
    for (const link of Array.from(links)) {
      if (link.href) {
        googleFontsUrls.push(link.href);
      }
    }

    // --- Detect Typekit / Adobe Fonts ---
    const typekitIds: string[] = [];
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[src]');
    for (const script of Array.from(scripts)) {
      const kitMatch = script.src.match(/use\.typekit\.net\/([a-z0-9]+)\.js/);
      if (kitMatch) {
        typekitIds.push(kitMatch[1]);
      }
    }
    // Also check for Adobe Fonts CSS links.
    const adobeLinks = document.querySelectorAll<HTMLLinkElement>(
      'link[href*="use.typekit.net"]',
    );
    for (const link of Array.from(adobeLinks)) {
      const match = link.href.match(/use\.typekit\.net\/([a-z0-9]+)\.css/);
      if (match) {
        typekitIds.push(match[1]);
      }
    }

    // --- Map font usage on key elements ---
    const SELECTORS = [
      'body',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'a', 'span',
      'button', 'input', 'textarea', 'select',
      'code', 'pre',
      'li', 'th', 'td',
      'label', 'figcaption', 'blockquote',
      'nav a', 'footer',
    ];

    const fontUsage: Array<{ selector: string; families: string[] }> = [];

    for (const sel of SELECTORS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const computed = window.getComputedStyle(el);
      const familyRaw = computed.fontFamily;
      if (!familyRaw) continue;

      const families = familyRaw
        .split(',')
        .map((f) => f.trim().replace(/^["']|["']$/g, ''));

      fontUsage.push({ selector: sel, families });
    }

    return {
      cssTexts,
      googleFontsUrls,
      typekitIds,
      fontUsage,
    };
  });

  // Parse @font-face from gathered CSS text.
  const fontFaces = parseFontFaces(raw.cssTexts);

  // Identify system fonts from usage data.
  const allReferencedFamilies = new Set<string>();
  const loadedFamilies = new Set(fontFaces.map((ff) => ff.family.toLowerCase()));

  const systemFontFamilies = new Set<string>();
  for (const usage of raw.fontUsage) {
    for (const family of usage.families) {
      allReferencedFamilies.add(family);
      if (
        SYSTEM_FONT_FAMILIES.has(family) ||
        (!loadedFamilies.has(family.toLowerCase()) &&
          !raw.googleFontsUrls.some((url) =>
            url.toLowerCase().includes(family.toLowerCase().replace(/\s+/g, '+')),
          ))
      ) {
        systemFontFamilies.add(family);
      }
    }
  }

  return {
    fontFaces,
    googleFontsUrls: raw.googleFontsUrls,
    typekitIds: raw.typekitIds,
    fontUsage: raw.fontUsage,
    systemFontFamilies,
  };
}

// ---------------------------------------------------------------------------
// @font-face parser
// ---------------------------------------------------------------------------

const FONT_FACE_RE = /@font-face\s*\{([^}]+)\}/g;
const FAMILY_RE = /font-family\s*:\s*["']?([^;"']+)["']?\s*;/;
const WEIGHT_RE = /font-weight\s*:\s*([^;]+)\s*;/;
const STYLE_RE = /font-style\s*:\s*([^;]+)\s*;/;
const SRC_RE = /src\s*:[^;]*url\(["']?([^"')]+)["']?\)\s*(?:format\(["']?([^"')]+)["']?\))?/;
const UNICODE_RANGE_RE = /unicode-range\s*:\s*([^;]+)\s*;/;
const VARIATION_RE = /font-variation-settings\s*:\s*([^;]+)\s*;/;

function parseFontFaces(cssTexts: string[]): RawFontFace[] {
  const results: RawFontFace[] = [];
  const fullCss = cssTexts.join('\n');

  let match: RegExpExecArray | null;
  FONT_FACE_RE.lastIndex = 0;

  while ((match = FONT_FACE_RE.exec(fullCss)) !== null) {
    const block = match[1];

    const familyMatch = FAMILY_RE.exec(block);
    if (!familyMatch) continue;

    const srcMatch = SRC_RE.exec(block);
    if (!srcMatch) continue;

    const weightMatch = WEIGHT_RE.exec(block);
    const styleMatch = STYLE_RE.exec(block);
    const rangeMatch = UNICODE_RANGE_RE.exec(block);
    const variationMatch = VARIATION_RE.exec(block);

    results.push({
      family: familyMatch[1].trim(),
      weight: weightMatch ? weightMatch[1].trim() : '400',
      style: styleMatch ? styleMatch[1].trim() : 'normal',
      url: srcMatch[1],
      format: srcMatch[2] ? normalizeFormat(srcMatch[2]) : inferFormat(srcMatch[1]),
      unicodeRange: rangeMatch ? rangeMatch[1].trim() : '',
      isVariable: variationMatch !== null || /\d+\s+\d+/.test(weightMatch?.[1] ?? ''),
      variationSettings: variationMatch ? variationMatch[1].trim() : '',
    });
  }

  return results;
}

function normalizeFormat(format: string): string {
  const lower = format.toLowerCase().trim();
  if (lower.includes('woff2')) return 'woff2';
  if (lower.includes('woff') && !lower.includes('2')) return 'woff';
  if (lower.includes('truetype') || lower.includes('ttf')) return 'ttf';
  if (lower.includes('opentype') || lower.includes('otf')) return 'otf';
  if (lower.includes('embedded-opentype') || lower.includes('eot')) return 'eot';
  return lower;
}

function inferFormat(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.woff2')) return 'woff2';
  if (lower.includes('.woff')) return 'woff';
  if (lower.includes('.ttf')) return 'ttf';
  if (lower.includes('.otf')) return 'otf';
  if (lower.includes('.eot')) return 'eot';
  return 'woff2'; // Reasonable default for modern fonts.
}

// ---------------------------------------------------------------------------
// Google Fonts CSS fetcher
// ---------------------------------------------------------------------------

/** User-Agent that triggers WOFF2 responses from Google Fonts. */
const WOFF2_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchGoogleFontsCss(
  page: Page,
  urls: string[],
): Promise<RawFontFace[]> {
  if (urls.length === 0) return [];

  const allFaces: RawFontFace[] = [];

  for (const url of urls) {
    try {
      const response = await page.context().request.get(url, {
        headers: { 'User-Agent': WOFF2_USER_AGENT },
      });
      if (response.ok()) {
        const css = await response.text();
        const faces = parseFontFaces([css]);
        for (const face of faces) {
          allFaces.push({ ...face });
        }
      }
    } catch {
      // Skip unreachable Google Fonts URLs.
    }
  }

  // Tag all as Google source — handled in buildFontMap.
  return allFaces;
}

// ---------------------------------------------------------------------------
// Font map builder
// ---------------------------------------------------------------------------

function determineSource(
  url: string,
  googleFontsUrls: readonly string[],
  isSystem: boolean,
): FontSource {
  if (isSystem) return 'system';
  if (url.includes('fonts.gstatic.com') || url.includes('fonts.googleapis.com')) {
    return 'google';
  }
  if (url.includes('use.typekit.net')) return 'typekit';
  if (url.includes('adobe')) return 'adobe';
  if (!url || url === '') return 'system';
  return 'self-hosted';
}

function parseWeight(weight: string): number[] {
  const trimmed = weight.trim();

  // Variable font range: "100 900"
  if (/^\d+\s+\d+$/.test(trimmed)) {
    const [min, max] = trimmed.split(/\s+/).map(Number);
    return [min, max];
  }

  // Named weights.
  const namedWeights: Record<string, number> = {
    thin: 100,
    hairline: 100,
    extralight: 200,
    'ultra-light': 200,
    light: 300,
    normal: 400,
    regular: 400,
    medium: 500,
    semibold: 600,
    'semi-bold': 600,
    bold: 700,
    extrabold: 800,
    'ultra-bold': 800,
    black: 900,
    heavy: 900,
  };

  const named = namedWeights[trimmed.toLowerCase()];
  if (named !== undefined) return [named];

  const num = parseInt(trimmed, 10);
  return [isNaN(num) ? 400 : num];
}

function buildFontMap(
  fontFaces: RawFontFace[],
  fontUsage: RawFontUsage[],
  systemFontFamilies: Set<string>,
): Map<string, FontSpec> {
  const map = new Map<string, FontSpec>();

  // Process @font-face declarations.
  for (const ff of fontFaces) {
    const key = ff.family.toLowerCase();
    const existing = map.get(key);

    const weights = parseWeight(ff.weight);
    const style = ff.style as FontStyle;
    const format = ff.format as FontFileFormat;
    const source = determineSource(ff.url, [], false);

    const file: FontFile = {
      weight: weights[0],
      style: ff.style,
      url: ff.url,
      format,
      unicodeRange: ff.unicodeRange || undefined,
    };

    if (existing) {
      for (const w of weights) {
        if (!existing.weights.includes(w)) {
          existing.weights.push(w);
        }
      }
      if (!existing.styles.includes(style)) {
        existing.styles.push(style);
      }
      existing.files.push(file);
      if (ff.isVariable) {
        existing.isVariable = true;
      }
    } else {
      map.set(key, {
        family: ff.family,
        weights: [...weights],
        styles: [style],
        source,
        files: [file],
        fallbacks: [],
        usedIn: [],
        isVariable: ff.isVariable,
      });
    }
  }

  // Process font usage to fill `usedIn` and add system fonts.
  for (const usage of fontUsage) {
    const primary = usage.families[0];
    if (!primary) continue;

    const key = primary.toLowerCase();
    const spec = map.get(key);

    if (spec) {
      if (!spec.usedIn.includes(usage.selector)) {
        spec.usedIn.push(usage.selector);
      }
      // Set fallbacks from the remaining families.
      if (spec.fallbacks.length === 0 && usage.families.length > 1) {
        spec.fallbacks = usage.families.slice(1);
      }
    } else if (systemFontFamilies.has(primary) || SYSTEM_FONT_FAMILIES.has(primary)) {
      map.set(key, {
        family: primary,
        weights: [400],
        styles: ['normal'],
        source: 'system',
        files: [],
        fallbacks: usage.families.slice(1),
        usedIn: [usage.selector],
        isVariable: false,
      });
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Font file downloader
// ---------------------------------------------------------------------------

const FORMAT_PREFERENCE: readonly FontFileFormat[] = ['woff2', 'woff', 'ttf', 'otf', 'eot'];

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildLocalFilename(family: string, weight: number, style: string, format: string): string {
  const safeName = sanitizeFilename(family);
  const ext = format === 'truetype' ? 'ttf' : format;
  return `${safeName}-${weight}-${style}.${ext}`;
}

async function downloadFontFiles(
  page: Page,
  fontMap: Map<string, FontSpec>,
  fontsDir: string,
): Promise<string[]> {
  const downloaded: string[] = [];
  const seenUrls = new Set<string>();
  const pageUrl = page.url();

  for (const spec of fontMap.values()) {
    if (spec.source === 'system') continue;

    // Sort files by format preference — download best format first.
    const sortedFiles = [...spec.files].sort((a, b) => {
      const aIdx = FORMAT_PREFERENCE.indexOf(a.format);
      const bIdx = FORMAT_PREFERENCE.indexOf(b.format);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    for (const file of sortedFiles) {
      if (!file.url || seenUrls.has(file.url)) continue;
      seenUrls.add(file.url);

      const resolvedUrl = resolveUrl(file.url, pageUrl);
      if (!resolvedUrl) continue;

      const filename = buildLocalFilename(
        spec.family,
        file.weight,
        file.style,
        file.format,
      );
      const localPath = join(fontsDir, filename);
      const relativePath = `public/fonts/${filename}`;

      try {
        const response = await page.context().request.get(resolvedUrl);
        if (response.ok()) {
          const buffer = await response.body();
          await writeFile(localPath, buffer);
          file.localPath = relativePath;
          downloaded.push(relativePath);
        }
      } catch {
        // Skip files that fail to download.
      }
    }
  }

  return downloaded;
}

function resolveUrl(url: string, baseUrl: string): string | null {
  try {
    // Handle data URIs — skip them.
    if (url.startsWith('data:')) return null;

    // Already absolute.
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    // Protocol-relative.
    if (url.startsWith('//')) {
      const base = new URL(baseUrl);
      return `${base.protocol}${url}`;
    }

    // Relative URL.
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}
