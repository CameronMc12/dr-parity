/**
 * Design token extractor — distills raw PageData into a unified DesignTokens
 * object with colors, typography, spacing, border radii, and shadows.
 */

import type {
  PageData,
  ColorToken,
  SpacingToken,
  ElementSpec,
  FontSpec,
  CSSVariableData,
} from '../types/extraction';
import type {
  DesignTokens,
  GradientToken,
  GradientStop,
  GradientType,
  TypographyScale,
  SpacingScale,
  RadiusScale,
  ShadowToken,
} from '../types/component';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function extractDesignTokens(data: PageData): DesignTokens {
  const allElements = flattenElements(data);
  const colors = buildColorTokens(data, allElements);
  const typography = buildTypographyScale(data, allElements);
  const spacing = buildSpacingScale(data);
  const borderRadius = buildRadiusScale(allElements);
  const shadows = buildShadowTokens(allElements);
  const gradients = extractGradients(allElements);
  const breakpoints = collectBreakpoints(data);

  // Collect original CSS custom properties from stylesheets
  const originalVariables = collectOriginalCssVariables(data);

  // Prefer original variable names when they match extracted color values
  applyOriginalVariableNames(colors, originalVariables);

  const cssVariables = generateCssVariables(
    colors, typography, spacing, borderRadius, shadows, gradients, originalVariables,
  );

  return {
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
    gradients,
    fonts: data.fonts,
    breakpoints,
    cssVariables,
  };
}

// ---------------------------------------------------------------------------
// Element flattening
// ---------------------------------------------------------------------------

function flattenElements(data: PageData): ElementSpec[] {
  const result: ElementSpec[] = [];
  for (const section of data.sections) {
    collectElements(section.elements, result);
  }
  return result;
}

function collectElements(elements: ElementSpec[], out: ElementSpec[]): void {
  for (const el of elements) {
    out.push(el);
    if (el.children.length > 0) {
      collectElements(el.children, out);
    }
  }
}

// ---------------------------------------------------------------------------
// Color extraction
// ---------------------------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function buildColorTokens(
  data: PageData,
  allElements: ElementSpec[],
): DesignTokens['colors'] {
  const colorMap = new Map<string, { token: ColorToken; rgb: Rgb }>();

  // Collect colors from computed styles
  for (const el of allElements) {
    addColorFromStyle(colorMap, el.computedStyles['color'], 'text');
    addColorFromStyle(colorMap, el.computedStyles['backgroundColor'], 'background');
    addColorFromStyle(colorMap, el.computedStyles['borderColor'], 'border');
    addColorFromStyle(colorMap, el.computedStyles['border-color'], 'border');
    addColorFromStyle(colorMap, el.computedStyles['background-color'], 'background');
  }

  // Merge extracted color tokens from PageData
  for (const ct of data.colors) {
    addColorFromStyle(colorMap, ct.value, ...ct.usage);
  }

  // Deduplicate similar colors (within delta 5 in RGB space)
  const deduped = deduplicateColors([...colorMap.values()]);

  // Sort by frequency descending
  const sorted = deduped.sort((a, b) => b.token.frequency - a.token.frequency);
  const allTokens = sorted.map((entry) => entry.token);

  // Assign semantic roles
  const background = findByUsage(sorted, 'background') ?? sorted[0]?.token ?? fallbackToken('background', '#ffffff');
  const foreground = findByUsage(sorted, 'text') ?? sorted[1]?.token ?? fallbackToken('foreground', '#000000');
  const border = findByUsage(sorted, 'border') ?? fallbackToken('border', '#e5e5e5');
  const muted = findMuted(sorted, background) ?? fallbackToken('muted', '#f5f5f5');

  // Primary = most frequent accent (not bg/fg/border)
  const primary = findPrimary(sorted, [background, foreground, border, muted]) ?? fallbackToken('primary', '#0066ff');

  // Secondary = next most frequent after primary
  const secondary = findSecondary(sorted, [background, foreground, border, muted, primary]);

  // Accent
  const accent = findAccent(sorted, [background, foreground, border, muted, primary]);

  assignCssVariables(background, '--color-background');
  assignCssVariables(foreground, '--color-foreground');
  assignCssVariables(border, '--color-border');
  assignCssVariables(muted, '--color-muted');
  assignCssVariables(primary, '--color-primary');
  if (secondary) assignCssVariables(secondary, '--color-secondary');
  if (accent) assignCssVariables(accent, '--color-accent');

  return {
    primary,
    secondary,
    background,
    foreground,
    muted,
    accent,
    border,
    all: allTokens,
  };
}

function addColorFromStyle(
  map: Map<string, { token: ColorToken; rgb: Rgb }>,
  value: string | undefined,
  ...usages: string[]
): void {
  if (!value) return;
  const rgb = parseColorToRgb(value);
  if (!rgb) return;
  const key = `${rgb.r},${rgb.g},${rgb.b}`;

  const existing = map.get(key);
  if (existing) {
    existing.token.frequency += 1;
    for (const u of usages) {
      if (!existing.token.usage.includes(u)) {
        existing.token.usage.push(u);
      }
    }
  } else {
    map.set(key, {
      token: {
        name: '',
        value,
        usage: [...usages],
        frequency: 1,
      },
      rgb,
    });
  }
}

function deduplicateColors(
  entries: { token: ColorToken; rgb: Rgb }[],
): { token: ColorToken; rgb: Rgb }[] {
  const result: { token: ColorToken; rgb: Rgb }[] = [];

  for (const entry of entries) {
    const match = result.find((r) => colorDistance(r.rgb, entry.rgb) < 5);
    if (match) {
      match.token.frequency += entry.token.frequency;
      for (const u of entry.token.usage) {
        if (!match.token.usage.includes(u)) {
          match.token.usage.push(u);
        }
      }
    } else {
      result.push({ ...entry, token: { ...entry.token } });
    }
  }

  return result;
}

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt(
    (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2,
  );
}

function findByUsage(
  sorted: { token: ColorToken; rgb: Rgb }[],
  usage: string,
): ColorToken | undefined {
  const match = sorted.find((e) => e.token.usage.includes(usage));
  return match?.token;
}

function findMuted(
  sorted: { token: ColorToken; rgb: Rgb }[],
  background: ColorToken,
): ColorToken | undefined {
  const bgRgb = parseColorToRgb(background.value);
  if (!bgRgb) return undefined;
  // Muted = a color close to background but not identical
  return sorted.find((e) => {
    const dist = colorDistance(e.rgb, bgRgb);
    return dist > 5 && dist < 60 && e.token.usage.includes('background');
  })?.token;
}

function findPrimary(
  sorted: { token: ColorToken; rgb: Rgb }[],
  exclude: (ColorToken | undefined)[],
): ColorToken | undefined {
  const excludeValues = new Set(exclude.filter(Boolean).map((t) => t!.value));
  return sorted.find((e) => !excludeValues.has(e.token.value) && e.token.frequency > 0)?.token;
}

function findSecondary(
  sorted: { token: ColorToken; rgb: Rgb }[],
  exclude: (ColorToken | undefined)[],
): ColorToken | undefined {
  const excludeValues = new Set(exclude.filter(Boolean).map((t) => t!.value));
  let skipped = false;
  for (const entry of sorted) {
    if (excludeValues.has(entry.token.value)) continue;
    if (!skipped) {
      skipped = true;
      continue;
    }
    return entry.token;
  }
  return undefined;
}

function findAccent(
  sorted: { token: ColorToken; rgb: Rgb }[],
  exclude: (ColorToken | undefined)[],
): ColorToken | undefined {
  const excludeValues = new Set(exclude.filter(Boolean).map((t) => t!.value));
  // Accent = a vivid color (high saturation heuristic)
  return sorted.find((e) => {
    if (excludeValues.has(e.token.value)) return false;
    const { r, g, b } = e.rgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    return saturation > 0.3;
  })?.token;
}

function assignCssVariables(token: ColorToken, varName: string): void {
  token.cssVariable = varName;
  if (!token.name) {
    token.name = varName.replace('--color-', '');
  }
}

function fallbackToken(name: string, value: string): ColorToken {
  return { name, value, usage: [], frequency: 0 };
}

// ---------------------------------------------------------------------------
// Typography extraction
// ---------------------------------------------------------------------------

function buildTypographyScale(
  data: PageData,
  allElements: ElementSpec[],
): TypographyScale {
  // Collect font-size / line-height / weight combos
  const sizeMap = new Map<string, { value: string; lineHeight: string; count: number; usages: string[] }>();

  for (const el of allElements) {
    const fontSize = el.computedStyles['fontSize'] ?? el.computedStyles['font-size'];
    const lineHeight = el.computedStyles['lineHeight'] ?? el.computedStyles['line-height'] ?? 'normal';
    if (!fontSize) continue;

    const key = `${fontSize}|${lineHeight}`;
    const existing = sizeMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      sizeMap.set(key, { value: fontSize, lineHeight, count: 1, usages: [el.tag] });
    }
  }

  // Sort by pixel value
  const sizes = [...sizeMap.values()]
    .sort((a, b) => parseFloat(a.value) - parseFloat(b.value))
    .map((entry, idx) => ({
      name: inferSizeName(parseFloat(entry.value), idx),
      value: entry.value,
      lineHeight: entry.lineHeight,
      usage: entry.usages,
    }));

  // Collect weights
  const weightSet = new Set<number>();
  for (const el of allElements) {
    const w = el.computedStyles['fontWeight'] ?? el.computedStyles['font-weight'];
    if (w) weightSet.add(Number(w));
  }
  const weights = [...weightSet].sort((a, b) => a - b);

  // Map font families
  const fontFamilies = classifyFontFamilies(data.fonts);

  return { fontFamilies, sizes, weights };
}

function inferSizeName(px: number, idx: number): string {
  if (px <= 10) return 'xxs';
  if (px <= 12) return 'xs';
  if (px <= 14) return 'sm';
  if (px <= 16) return 'base';
  if (px <= 18) return 'lg';
  if (px <= 20) return 'xl';
  if (px <= 24) return '2xl';
  if (px <= 30) return '3xl';
  if (px <= 36) return '4xl';
  if (px <= 48) return '5xl';
  if (px <= 64) return '6xl';
  if (px <= 80) return '7xl';
  if (px <= 96) return '8xl';
  return `size-${idx}`;
}

function classifyFontFamilies(fonts: FontSpec[]): TypographyScale['fontFamilies'] {
  let sans = 'system-ui, sans-serif';
  let mono = 'monospace';
  let serif: string | undefined;

  for (const font of fonts) {
    const fallbackStr = font.fallbacks.join(', ');
    const fullStack = font.family + (fallbackStr ? `, ${fallbackStr}` : '');

    if (isMonoFont(font)) {
      mono = fullStack;
    } else if (isSerifFont(font)) {
      serif = fullStack;
    } else {
      sans = fullStack;
    }
  }

  return { sans, mono, ...(serif ? { serif } : {}) };
}

function isMonoFont(font: FontSpec): boolean {
  const lower = font.family.toLowerCase();
  return (
    lower.includes('mono') ||
    lower.includes('code') ||
    lower.includes('consolas') ||
    lower.includes('courier') ||
    font.fallbacks.some((f) => f.toLowerCase().includes('monospace'))
  );
}

function isSerifFont(font: FontSpec): boolean {
  const lower = font.family.toLowerCase();
  return (
    lower.includes('serif') ||
    lower.includes('georgia') ||
    lower.includes('times') ||
    lower.includes('garamond') ||
    lower.includes('playfair') ||
    font.fallbacks.some((f) => f.toLowerCase() === 'serif')
  );
}

// ---------------------------------------------------------------------------
// Spacing extraction
// ---------------------------------------------------------------------------

function buildSpacingScale(data: PageData): SpacingScale {
  const values = new Set<number>();

  for (const token of data.spacing) {
    values.add(token.value);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const baseUnit = detectBaseUnit(sorted);

  return { values: sorted, baseUnit };
}

function detectBaseUnit(sorted: number[]): number {
  if (sorted.length < 2) return 4;

  // Count how many values are divisible by 8 vs 4
  const div8 = sorted.filter((v) => v > 0 && v % 8 === 0).length;
  const div4 = sorted.filter((v) => v > 0 && v % 4 === 0).length;

  // If most values are multiples of 8, use 8; otherwise 4
  return div8 > sorted.length * 0.5 ? 8 : 4;
}

// ---------------------------------------------------------------------------
// Border radius extraction
// ---------------------------------------------------------------------------

function buildRadiusScale(allElements: ElementSpec[]): RadiusScale {
  const radiusMap = new Map<string, number>();

  for (const el of allElements) {
    const br = el.computedStyles['borderRadius'] ?? el.computedStyles['border-radius'];
    if (!br || br === '0px') continue;
    radiusMap.set(br, (radiusMap.get(br) ?? 0) + 1);
  }

  const entries = [...radiusMap.entries()]
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([value, frequency], idx) => ({
      name: inferRadiusName(value, idx),
      value,
      frequency,
    }));

  return { values: entries };
}

function inferRadiusName(value: string, idx: number): string {
  const px = parseFloat(value);
  if (value === '9999px' || value === '50%') return 'full';
  if (px <= 2) return 'sm';
  if (px <= 6) return 'md';
  if (px <= 8) return 'DEFAULT';
  if (px <= 12) return 'lg';
  if (px <= 16) return 'xl';
  if (px <= 24) return '2xl';
  return `radius-${idx}`;
}

// ---------------------------------------------------------------------------
// Shadow extraction
// ---------------------------------------------------------------------------

function buildShadowTokens(allElements: ElementSpec[]): ShadowToken[] {
  const shadowMap = new Map<string, number>();

  for (const el of allElements) {
    const bs = el.computedStyles['boxShadow'] ?? el.computedStyles['box-shadow'];
    if (!bs || bs === 'none') continue;
    shadowMap.set(bs, (shadowMap.get(bs) ?? 0) + 1);
  }

  return [...shadowMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, frequency], idx) => ({
      name: inferShadowName(idx),
      value,
      frequency,
    }));
}

function inferShadowName(idx: number): string {
  const names = ['sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl'];
  return idx < names.length ? names[idx] : `shadow-${idx}`;
}

// ---------------------------------------------------------------------------
// Gradient extraction
// ---------------------------------------------------------------------------

const GRADIENT_PROPS = ['background', 'backgroundImage', 'background-image'] as const;

function extractGradients(allElements: ElementSpec[]): GradientToken[] {
  const gradients: GradientToken[] = [];
  const seen = new Set<string>();

  for (const el of allElements) {
    for (const prop of GRADIENT_PROPS) {
      const val = el.computedStyles[prop];
      if (val && val.includes('gradient') && !seen.has(val)) {
        seen.add(val);
        gradients.push(parseGradient(val, gradients.length));
      }
    }
  }

  return gradients;
}

function parseGradient(value: string, index: number): GradientToken {
  const type: GradientType = value.includes('radial')
    ? 'radial'
    : value.includes('conic')
      ? 'conic'
      : 'linear';

  const stops = parseGradientStops(value);

  let angle: string | undefined;
  let shape: string | undefined;

  if (type === 'linear') {
    const angleMatch = value.match(/linear-gradient\(\s*(\d+deg|to\s+[\w\s]+)/);
    if (angleMatch) angle = angleMatch[1].trim();
  } else if (type === 'radial') {
    const shapeMatch = value.match(/radial-gradient\(\s*([^,]+)/);
    if (shapeMatch) {
      const candidate = shapeMatch[1].trim();
      // Only store shape if it looks like a shape descriptor, not a color stop
      if (/^(circle|ellipse|closest|farthest|at\s)/i.test(candidate)) {
        shape = candidate;
      }
    }
  } else if (type === 'conic') {
    const fromMatch = value.match(/conic-gradient\(\s*(from\s+\d+deg)/);
    if (fromMatch) angle = fromMatch[1].trim();
  }

  const cssVariable = `--gradient-${index}`;

  return { value, type, stops, angle, shape, cssVariable };
}

function parseGradientStops(value: string): GradientStop[] {
  const stops: GradientStop[] = [];
  // Match color values followed by optional position percentages
  const colorPattern =
    /(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|[a-z]+)\s*(\d+%)?/gi;
  let match: RegExpExecArray | null;

  while ((match = colorPattern.exec(value)) !== null) {
    const colorCandidate = match[1];
    // Filter out CSS keywords that aren't colors
    if (/^(linear|radial|conic|gradient|to|from|at|circle|ellipse|closest|farthest|repeating)$/i.test(colorCandidate)) {
      continue;
    }
    stops.push({
      color: colorCandidate,
      position: match[2] || undefined,
    });
  }

  return stops;
}

// ---------------------------------------------------------------------------
// Breakpoints
// ---------------------------------------------------------------------------

function collectBreakpoints(data: PageData): number[] {
  const bpSet = new Set<number>();
  for (const section of data.sections) {
    for (const bp of section.responsiveBreakpoints) {
      bpSet.add(bp.width);
    }
  }
  return [...bpSet].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Original CSS custom-property collection
// ---------------------------------------------------------------------------

/**
 * Collects all CSS custom properties (--xxx) defined in the page's stylesheets.
 * These are the original variable names the target site used.
 */
function collectOriginalCssVariables(data: PageData): CSSVariableData[] {
  if (!data.stylesheets) return [];

  const variables: CSSVariableData[] = [];
  const seen = new Set<string>();

  for (const sheet of data.stylesheets.stylesheets) {
    for (const cssVar of sheet.cssVariables) {
      // Deduplicate by name+scope, preferring :root scope
      const key = `${cssVar.name}@${cssVar.scope}`;
      if (!seen.has(key)) {
        seen.add(key);
        variables.push(cssVar);
      }
    }
  }

  return variables;
}

/**
 * If the original site defined a CSS variable whose resolved value matches
 * one of our extracted color tokens, reassign the token's cssVariable name
 * to the original name instead of the auto-generated semantic name.
 */
function applyOriginalVariableNames(
  colors: DesignTokens['colors'],
  originalVariables: CSSVariableData[],
): void {
  // Build a map from resolved color value -> original variable name
  const valueToOriginalVar = new Map<string, string>();
  for (const cssVar of originalVariables) {
    const rgb = parseColorToRgb(cssVar.value);
    if (rgb) {
      const key = `${rgb.r},${rgb.g},${rgb.b}`;
      // Prefer variable names that look like color tokens
      if (!valueToOriginalVar.has(key) || cssVar.name.includes('color')) {
        valueToOriginalVar.set(key, cssVar.name);
      }
    }
  }

  // Apply original names to color tokens
  for (const token of colors.all) {
    const rgb = parseColorToRgb(token.value);
    if (!rgb) continue;
    const key = `${rgb.r},${rgb.g},${rgb.b}`;
    const originalName = valueToOriginalVar.get(key);
    if (originalName) {
      token.cssVariable = originalName;
      if (!token.name || token.name === originalName.replace('--', '').replace('color-', '')) {
        token.name = originalName.replace(/^--/, '');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CSS variable generation
// ---------------------------------------------------------------------------

function generateCssVariables(
  colors: DesignTokens['colors'],
  typography: TypographyScale,
  spacing: SpacingScale,
  borderRadius: RadiusScale,
  shadows: ShadowToken[],
  gradients: GradientToken[],
  originalVariables: CSSVariableData[] = [],
): Record<string, string> {
  const vars: Record<string, string> = {};

  // Colors
  for (const token of colors.all) {
    if (token.cssVariable) {
      vars[token.cssVariable] = token.value;
    }
  }

  // Typography
  vars['--font-sans'] = typography.fontFamilies.sans;
  vars['--font-mono'] = typography.fontFamilies.mono;
  if (typography.fontFamilies.serif) {
    vars['--font-serif'] = typography.fontFamilies.serif;
  }

  // Spacing
  for (const val of spacing.values) {
    vars[`--spacing-${val}`] = `${val}px`;
  }

  // Border radius
  for (const entry of borderRadius.values) {
    vars[`--radius-${entry.name}`] = entry.value;
  }

  // Shadows
  for (const shadow of shadows) {
    vars[`--shadow-${shadow.name}`] = shadow.value;
  }

  // Gradients
  for (const gradient of gradients) {
    if (gradient.cssVariable) {
      vars[gradient.cssVariable] = gradient.value;
    }
  }

  // Original site CSS custom properties (preserve names the target site used)
  for (const cssVar of originalVariables) {
    // Skip variables we already emitted under a different key
    if (vars[cssVar.name] !== undefined) continue;
    // Skip font/spacing/radius/shadow vars we've already generated
    if (
      cssVar.name.startsWith('--font-') ||
      cssVar.name.startsWith('--spacing-') ||
      cssVar.name.startsWith('--radius-') ||
      cssVar.name.startsWith('--shadow-') ||
      cssVar.name.startsWith('--gradient-')
    ) {
      continue;
    }
    vars[cssVar.name] = cssVar.value;
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Color parsing utility
// ---------------------------------------------------------------------------

function parseColorToRgb(color: string): Rgb | null {
  const trimmed = color.trim().toLowerCase();

  // rgb/rgba
  const rgbMatch = trimmed.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/,
  );
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  // hex
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  // hsl/hsla
  const hslMatch = trimmed.match(
    /hsla?\(\s*([\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%/,
  );
  if (hslMatch) {
    return hslToRgb(
      parseFloat(hslMatch[1]),
      parseFloat(hslMatch[2]),
      parseFloat(hslMatch[3]),
    );
  }

  // oklch
  const oklchMatch = trimmed.match(
    /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/,
  );
  if (oklchMatch) {
    return oklchToRgb(
      parseFloat(oklchMatch[1]),
      parseFloat(oklchMatch[2]),
      parseFloat(oklchMatch[3]),
    );
  }

  // lab
  const labMatch = trimmed.match(
    /lab\(\s*([\d.]+)%?\s+([\d.-]+)\s+([\d.-]+)/,
  );
  if (labMatch) {
    return labToRgb(
      parseFloat(labMatch[1]),
      parseFloat(labMatch[2]),
      parseFloat(labMatch[3]),
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Color space conversion helpers
// ---------------------------------------------------------------------------

/** HSL to sRGB (h in degrees, s and l in 0-100 range). */
function hslToRgb(h: number, s: number, l: number): Rgb {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
}

/**
 * OKLCH to sRGB (approximate conversion).
 * L: 0-1 (or 0-100 if percentage), C: chroma, H: hue in degrees.
 */
function oklchToRgb(l: number, c: number, h: number): Rgb {
  // Normalize L if it was given as a percentage (> 1).
  const lNorm = l > 1 ? l / 100 : l;
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLAB to approximate linear sRGB via the LMS cube-root path.
  const lms_l = lNorm + 0.3963377774 * a + 0.2158037573 * b;
  const lms_m = lNorm - 0.1055613458 * a - 0.0638541728 * b;
  const lms_s = lNorm - 0.0894841775 * a - 1.2914855480 * b;

  const lr = lms_l * lms_l * lms_l;
  const mr = lms_m * lms_m * lms_m;
  const sr = lms_s * lms_s * lms_s;

  const linearToSrgb = (v: number): number =>
    Math.round(
      Math.max(
        0,
        Math.min(
          255,
          v <= 0.0031308
            ? v * 12.92 * 255
            : (1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255,
        ),
      ),
    );

  return {
    r: linearToSrgb(4.0767416621 * lr - 3.3077115913 * mr + 0.2309699292 * sr),
    g: linearToSrgb(-1.2684380046 * lr + 2.6097574011 * mr - 0.3413193965 * sr),
    b: linearToSrgb(-0.0041960863 * lr - 0.7034186147 * mr + 1.7076147010 * sr),
  };
}

/**
 * CIE Lab to sRGB (simplified via XYZ intermediate).
 * L: 0-100, a/b: typically -128 to 127.
 */
function labToRgb(l: number, a: number, b: number): Rgb {
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const delta = 6 / 29;
  const cube = (t: number): number =>
    t > delta ? t * t * t : 3 * delta * delta * (t - 4 / 29);

  // D65 illuminant reference white.
  const x = cube(fx) * 0.95047;
  const y = cube(fy) * 1.0;
  const z = cube(fz) * 1.08883;

  // XYZ to linear sRGB.
  const rl = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gl = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const bl = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  const linearToSrgb = (v: number): number =>
    Math.round(
      Math.max(
        0,
        Math.min(
          255,
          v <= 0.0031308
            ? v * 12.92 * 255
            : (1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255,
        ),
      ),
    );

  return { r: linearToSrgb(rl), g: linearToSrgb(gl), b: linearToSrgb(bl) };
}
