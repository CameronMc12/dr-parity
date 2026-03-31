/**
 * Foundation generator — produces globals.css, layout.tsx, and icons.tsx
 * from extracted design tokens, page data, and topology.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { PageData, FontSpec, FontMetrics, SvgEntry, SvgSpriteSymbol, AnimationSpec } from '../types/extraction';
import type { DesignTokens, TopologyMap } from '../types/component';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FoundationOutput {
  globalsCss: string;
  layoutTsx: string;
  iconsTsx: string;
  filesWritten: string[];
}

export interface FoundationOptions {
  projectDir: string;
  pageData: PageData;
  tokens: DesignTokens;
  topology: TopologyMap;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateFoundation(
  options: FoundationOptions,
): Promise<FoundationOutput> {
  const { projectDir, pageData, tokens, topology } = options;

  const globalsCss = buildGlobalsCss(tokens, topology, pageData);
  const layoutTsx = buildLayoutTsx(tokens, pageData);
  const iconsTsx = buildIconsTsx(pageData.assets.svgs, pageData.assets.svgSprites);

  const files: { path: string; content: string }[] = [
    { path: join(projectDir, 'src/app/globals.css'), content: globalsCss },
    { path: join(projectDir, 'src/app/layout.tsx'), content: layoutTsx },
    { path: join(projectDir, 'src/components/icons.tsx'), content: iconsTsx },
  ];

  const filesWritten: string[] = [];
  for (const file of files) {
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, file.content, 'utf-8');
    filesWritten.push(file.path);
  }

  return { globalsCss, layoutTsx, iconsTsx, filesWritten };
}

// ---------------------------------------------------------------------------
// globals.css
// ---------------------------------------------------------------------------

function buildGlobalsCss(
  tokens: DesignTokens,
  topology: TopologyMap,
  pageData: PageData,
): string {
  const lines: string[] = [];

  // Tailwind v4 imports
  lines.push('@import "tailwindcss";');
  lines.push('@import "tw-animate-css";');
  lines.push('@import "shadcn/tailwind.css";');
  lines.push('');
  lines.push('@custom-variant dark (&:is(.dark *));');
  lines.push('');

  // Theme block — maps shadcn tokens + extracted font families
  lines.push('@theme inline {');
  lines.push('  --color-background: var(--background);');
  lines.push('  --color-foreground: var(--foreground);');
  lines.push(
    `  --font-sans: var(--font-sans), ${escapeCssString(tokens.typography.fontFamilies.sans)};`,
  );
  lines.push(
    `  --font-mono: var(--font-mono), ${escapeCssString(tokens.typography.fontFamilies.mono)};`,
  );
  if (tokens.typography.fontFamilies.serif) {
    lines.push(
      `  --font-serif: var(--font-serif), ${escapeCssString(tokens.typography.fontFamilies.serif)};`,
    );
  }
  lines.push('  --font-heading: var(--font-sans);');
  lines.push('');

  // shadcn colour bridge tokens
  const shadcnBridge = [
    'sidebar-ring', 'sidebar-border', 'sidebar-accent-foreground',
    'sidebar-accent', 'sidebar-primary-foreground', 'sidebar-primary',
    'sidebar-foreground', 'sidebar',
    'chart-5', 'chart-4', 'chart-3', 'chart-2', 'chart-1',
    'ring', 'input', 'border', 'destructive',
    'accent-foreground', 'accent', 'muted-foreground', 'muted',
    'secondary-foreground', 'secondary', 'primary-foreground', 'primary',
    'popover-foreground', 'popover', 'card-foreground', 'card',
  ];
  for (const name of shadcnBridge) {
    lines.push(`  --color-${name}: var(--${name});`);
  }

  // Radius tokens
  lines.push('  --radius-sm: calc(var(--radius) * 0.6);');
  lines.push('  --radius-md: calc(var(--radius) * 0.8);');
  lines.push('  --radius-lg: var(--radius);');
  lines.push('  --radius-xl: calc(var(--radius) * 1.4);');
  lines.push('  --radius-2xl: calc(var(--radius) * 1.8);');
  lines.push('  --radius-3xl: calc(var(--radius) * 2.2);');
  lines.push('  --radius-4xl: calc(var(--radius) * 2.6);');
  lines.push('}');
  lines.push('');

  // :root — extracted design token values
  lines.push(':root {');
  lines.push(`  --background: ${tokens.colors.background.value};`);
  lines.push(`  --foreground: ${tokens.colors.foreground.value};`);
  lines.push(`  --primary: ${tokens.colors.primary.value};`);
  lines.push(`  --primary-foreground: ${contrastForeground(tokens.colors.primary.value)};`);
  if (tokens.colors.secondary) {
    lines.push(`  --secondary: ${tokens.colors.secondary.value};`);
    lines.push(`  --secondary-foreground: ${contrastForeground(tokens.colors.secondary.value)};`);
  } else {
    lines.push('  --secondary: oklch(0.97 0 0);');
    lines.push('  --secondary-foreground: oklch(0.205 0 0);');
  }
  lines.push(`  --muted: ${tokens.colors.muted.value};`);
  lines.push(`  --muted-foreground: ${contrastForeground(tokens.colors.muted.value)};`);
  if (tokens.colors.accent) {
    lines.push(`  --accent: ${tokens.colors.accent.value};`);
    lines.push(`  --accent-foreground: ${contrastForeground(tokens.colors.accent.value)};`);
  } else {
    lines.push('  --accent: oklch(0.97 0 0);');
    lines.push('  --accent-foreground: oklch(0.205 0 0);');
  }
  lines.push(`  --border: ${tokens.colors.border.value};`);
  lines.push(`  --input: ${tokens.colors.border.value};`);
  lines.push(`  --ring: ${tokens.colors.primary.value};`);
  lines.push('  --card: var(--background);');
  lines.push('  --card-foreground: var(--foreground);');
  lines.push('  --popover: var(--background);');
  lines.push('  --popover-foreground: var(--foreground);');
  lines.push('  --destructive: oklch(0.577 0.245 27.325);');

  // Chart tokens — derive from primary
  lines.push('  --chart-1: oklch(0.87 0 0);');
  lines.push('  --chart-2: oklch(0.556 0 0);');
  lines.push('  --chart-3: oklch(0.439 0 0);');
  lines.push('  --chart-4: oklch(0.371 0 0);');
  lines.push('  --chart-5: oklch(0.269 0 0);');

  // Radius base
  const radiusBase = tokens.borderRadius.values[0]?.value ?? '0.625rem';
  lines.push(`  --radius: ${radiusBase};`);

  // Sidebar defaults
  lines.push('  --sidebar: oklch(0.985 0 0);');
  lines.push('  --sidebar-foreground: var(--foreground);');
  lines.push('  --sidebar-primary: var(--primary);');
  lines.push('  --sidebar-primary-foreground: var(--primary-foreground);');
  lines.push('  --sidebar-accent: var(--accent);');
  lines.push('  --sidebar-accent-foreground: var(--accent-foreground);');
  lines.push('  --sidebar-border: var(--border);');
  lines.push('  --sidebar-ring: var(--ring);');

  // Extracted gradient tokens
  if (tokens.gradients.length > 0) {
    lines.push('');
    lines.push('  /* Extracted gradients */');
    for (const gradient of tokens.gradients) {
      if (gradient.cssVariable) {
        lines.push(`  ${gradient.cssVariable}: ${gradient.value};`);
      }
    }
  }

  // Site-specific custom properties from tokens.cssVariables
  // This includes both auto-generated tokens (spacing, radius, shadow) and
  // original CSS custom properties extracted from the target site's stylesheets.
  const siteVars: Array<[string, string]> = [];
  const autoVars: Array<[string, string]> = [];
  for (const [varName, varValue] of Object.entries(tokens.cssVariables)) {
    // Skip ones we already emitted above
    if (
      varName.startsWith('--color-') ||
      varName.startsWith('--gradient-') ||
      varName === '--font-sans' ||
      varName === '--font-mono' ||
      varName === '--font-serif'
    ) {
      continue;
    }
    // Categorize: auto-generated vs original site variables
    const isAutoGenerated =
      varName.startsWith('--spacing-') ||
      varName.startsWith('--radius-') ||
      varName.startsWith('--shadow-');
    if (isAutoGenerated) {
      autoVars.push([varName, varValue]);
    } else {
      siteVars.push([varName, varValue]);
    }
  }

  // Emit auto-generated tokens
  for (const [varName, varValue] of autoVars) {
    lines.push(`  ${varName}: ${varValue};`);
  }

  // Emit original site CSS custom properties
  if (siteVars.length > 0) {
    lines.push('');
    lines.push('  /* Original site CSS custom properties */');
    for (const [varName, varValue] of siteVars) {
      lines.push(`  ${varName}: ${varValue};`);
    }
  }
  lines.push('}');
  lines.push('');

  // Base layer
  lines.push('@layer base {');
  lines.push('  * {');
  lines.push('    @apply border-border outline-ring/50;');
  lines.push('  }');
  lines.push('');
  lines.push('  html {');
  lines.push('    scroll-behavior: smooth;');
  lines.push('    -webkit-font-smoothing: antialiased;');
  lines.push('    -moz-osx-font-smoothing: grayscale;');
  lines.push('  }');
  lines.push('');
  lines.push('  body {');
  lines.push('    @apply bg-background text-foreground;');
  lines.push(
    `    font-family: var(--font-sans), ${escapeCssString(tokens.typography.fontFamilies.sans)};`,
  );
  lines.push('  }');
  lines.push('');
  lines.push('  code, kbd, pre, samp {');
  lines.push(
    `    font-family: var(--font-mono), ${escapeCssString(tokens.typography.fontFamilies.mono)};`,
  );
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Utility classes
  lines.push('/* Hide scrollbar */');
  lines.push('.hide-scrollbar {');
  lines.push('  -ms-overflow-style: none;');
  lines.push('  scrollbar-width: none;');
  lines.push('}');
  lines.push('.hide-scrollbar::-webkit-scrollbar {');
  lines.push('  display: none;');
  lines.push('}');
  lines.push('');

  // Font metric override fallbacks — reduces CLS during font loading.
  const metricFallbacks = buildFontMetricFallbacks(pageData.fonts);
  if (metricFallbacks.length > 0) {
    lines.push('/* Font metric fallbacks (ascent-override, descent-override, size-adjust) */');
    for (const rule of metricFallbacks) {
      lines.push(rule);
    }
    lines.push('');
  }

  // Lenis smooth-scroll CSS (if detected)
  if (topology.hasSmoothScroll && topology.smoothScrollLibrary === 'lenis') {
    lines.push('/* Lenis smooth scroll */');
    lines.push('html.lenis, html.lenis body {');
    lines.push('  height: auto;');
    lines.push('}');
    lines.push('.lenis.lenis-smooth {');
    lines.push('  scroll-behavior: auto !important;');
    lines.push('}');
    lines.push('.lenis.lenis-smooth [data-lenis-prevent] {');
    lines.push('  overscroll-behavior: contain;');
    lines.push('}');
    lines.push('.lenis.lenis-stopped {');
    lines.push('  overflow: hidden;');
    lines.push('}');
    lines.push('');
  }

  // Scroll snap (if detected)
  if (topology.hasScrollSnap) {
    lines.push('/* Scroll snap */');
    lines.push('.snap-container {');
    lines.push('  scroll-snap-type: y mandatory;');
    lines.push('  overflow-y: scroll;');
    lines.push('  height: 100vh;');
    lines.push('}');
    lines.push('.snap-section {');
    lines.push('  scroll-snap-align: start;');
    lines.push('}');
    lines.push('');
  }

  // Extracted keyframe animations
  const keyframeAnimations = collectKeyframeAnimations(pageData);
  if (keyframeAnimations.length > 0) {
    lines.push('/* Extracted animations */');
    for (const anim of keyframeAnimations) {
      lines.push(`@keyframes ${sanitizeAnimationName(anim.id)} {`);
      for (const kf of anim.keyframes ?? []) {
        const offset = Math.round(kf.offset * 100);
        const props = Object.entries(kf.styles)
          .map(([prop, val]) => `    ${camelToKebab(prop)}: ${val};`)
          .join('\n');
        lines.push(`  ${offset}% {`);
        lines.push(props);
        lines.push('  }');
      }
      lines.push('}');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// layout.tsx
// ---------------------------------------------------------------------------

function buildLayoutTsx(tokens: DesignTokens, pageData: PageData): string {
  const lines: string[] = [];

  lines.push('import type { Metadata } from "next";');

  // Determine font imports
  const fontImports = buildFontImports(tokens.fonts);
  for (const imp of fontImports.importLines) {
    lines.push(imp);
  }
  lines.push('import "./globals.css";');
  lines.push('');

  // Font variable declarations
  for (const decl of fontImports.declarations) {
    lines.push(decl);
    lines.push('');
  }

  // Metadata
  lines.push('export const metadata: Metadata = {');
  lines.push(`  title: ${JSON.stringify(pageData.title || 'Dr Parity')},`);
  lines.push(
    `  description: ${JSON.stringify(pageData.description || '')},`,
  );
  lines.push('};');
  lines.push('');

  // Layout component
  const fontClassNames = fontImports.variableClassNames.join(' ');
  const classExpr = fontClassNames
    ? '`${' + fontImports.variableClassNames.map((_, i) => fontImports.varNames[i] + '.variable').join(' + " " + ') + '} h-full antialiased`'
    : '"h-full antialiased"';

  lines.push('export default function RootLayout({');
  lines.push('  children,');
  lines.push('}: Readonly<{');
  lines.push('  children: React.ReactNode;');
  lines.push('}>) {');
  lines.push('  return (');
  lines.push('    <html');
  lines.push('      lang="en"');
  lines.push(`      className={${classExpr}}`);
  lines.push('    >');
  lines.push('      <body className="min-h-full flex flex-col">{children}</body>');
  lines.push('    </html>');
  lines.push('  );');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// icons.tsx
// ---------------------------------------------------------------------------

function buildIconsTsx(svgs: SvgEntry[], spriteSymbols?: SvgSpriteSymbol[]): string {
  const lines: string[] = [];

  lines.push('import type { SVGAttributes } from "react";');
  lines.push('');

  const hasSprites = spriteSymbols && spriteSymbols.length > 0;

  if (svgs.length === 0 && !hasSprites) {
    lines.push('// No SVG icons extracted from target site.');
    lines.push('export {};');
    lines.push('');
    return lines.join('\n');
  }

  const usedNames = new Set<string>();

  // Inline SVGs
  for (const svg of svgs) {
    const baseName = svg.componentName ?? 'Icon';
    const name = deduplicateName(baseName, usedNames);
    usedNames.add(name);

    const cleanedSvg = cleanSvgContent(svg.content, svg.viewBox);

    lines.push(`export function ${name}({`);
    lines.push('  className,');
    lines.push('  ...props');
    lines.push('}: { className?: string } & SVGAttributes<SVGSVGElement>) {');
    lines.push('  return (');
    lines.push(`    ${cleanedSvg.replace('<svg', '<svg className={className} {...props}')}`);
    lines.push('  );');
    lines.push('}');
    lines.push('');
  }

  // Sprite symbols — each rendered as a standalone SVG component
  if (hasSprites) {
    lines.push('// --- SVG sprite symbols (extracted from <symbol> elements) ---');
    lines.push('');

    for (const sym of spriteSymbols!) {
      const name = deduplicateName(sym.componentName, usedNames);
      usedNames.add(name);

      const viewBoxAttr = sym.viewBox ? ` viewBox="${sym.viewBox}"` : '';

      lines.push(`export function ${name}({`);
      lines.push('  className,');
      lines.push('  ...props');
      lines.push('}: { className?: string } & SVGAttributes<SVGSVGElement>) {');
      lines.push('  return (');
      lines.push(`    <svg${viewBoxAttr} fill="currentColor" className={className} {...props}>`);
      lines.push(`      ${sym.content}`);
      lines.push('    </svg>');
      lines.push('  );');
      lines.push('}');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Font import helpers
// ---------------------------------------------------------------------------

interface FontImportResult {
  importLines: string[];
  declarations: string[];
  variableClassNames: string[];
  varNames: string[];
}

function buildFontImports(fonts: FontSpec[]): FontImportResult {
  const importLines: string[] = [];
  const declarations: string[] = [];
  const variableClassNames: string[] = [];
  const varNames: string[] = [];

  // Always need at least a sans and mono font
  let hasSans = false;
  let hasMono = false;

  for (const font of fonts) {
    if (isMonoFont(font)) {
      if (hasMono) continue;
      hasMono = true;
    } else if (!hasSans) {
      hasSans = true;
    }

    const cssVarName = isMonoFont(font) ? '--font-mono' : '--font-sans';
    const jsVarName = toJsVarName(font.family);

    if (font.source === 'google') {
      const importName = font.family.replace(/\s+/g, '_');
      importLines.push(
        `import { ${importName} } from "next/font/google";`,
      );
      const weightsArr = font.weights.length > 0 ? font.weights : [400, 700];
      declarations.push(
        `const ${jsVarName} = ${importName}({\n` +
        `  variable: "${cssVarName}",\n` +
        `  subsets: ["latin"],\n` +
        `  weight: [${weightsArr.map((w) => `"${w}"`).join(', ')}],\n` +
        `  display: "swap",\n` +
        `});`,
      );
    } else if (font.source === 'self-hosted' && font.files.length > 0) {
      importLines.push('import localFont from "next/font/local";');
      const filesWithPaths = font.files.filter((f) => f.localPath);
      const srcEntries = filesWithPaths.map(
        (f) =>
          `    { path: "${f.localPath}", weight: "${f.weight}", style: "${f.style}" }`,
      );
      const hasMetrics = filesWithPaths.some((f) => f.metrics);
      const adjustLine = hasMetrics ? `  adjustFontFallback: false,\n` : '';

      // Variable font weight range (Item 2.4)
      let weightLine = '';
      if (font.isVariable && font.variableAxes?.['wght']) {
        const wghtAxis = font.variableAxes['wght'];
        weightLine = `  weight: "${wghtAxis.min} ${wghtAxis.max}",\n`;
      }

      declarations.push(
        `const ${jsVarName} = localFont({\n` +
        `  variable: "${cssVarName}",\n` +
        `  src: [\n${srcEntries.join(',\n')}\n  ],\n` +
        weightLine +
        `  display: "swap",\n` +
        adjustLine +
        `});`,
      );
    } else {
      // System or unknown — use Inter as safe fallback for sans
      if (!isMonoFont(font)) {
        importLines.push('import { Inter } from "next/font/google";');
        declarations.push(
          `const ${jsVarName} = Inter({\n` +
          `  variable: "${cssVarName}",\n` +
          `  subsets: ["latin"],\n` +
          `  display: "swap",\n` +
          `});`,
        );
      } else {
        importLines.push('import { GeistMono } from "geist/font/mono";');
        declarations.push(`const ${jsVarName} = GeistMono;`);
      }
    }

    variableClassNames.push(`\${${jsVarName}.variable}`);
    varNames.push(jsVarName);
  }

  // Ensure we always have sans + mono
  if (!hasSans) {
    importLines.push('import { Inter } from "next/font/google";');
    declarations.push(
      'const inter = Inter({\n' +
      '  variable: "--font-sans",\n' +
      '  subsets: ["latin"],\n' +
      '  display: "swap",\n' +
      '});',
    );
    variableClassNames.push('${inter.variable}');
    varNames.push('inter');
  }
  if (!hasMono) {
    importLines.push('import { GeistMono } from "geist/font/mono";');
    declarations.push('const geistMono = GeistMono;');
    variableClassNames.push('${geistMono.variable}');
    varNames.push('geistMono');
  }

  // Deduplicate import lines
  const uniqueImports = [...new Set(importLines)];

  return {
    importLines: uniqueImports,
    declarations,
    variableClassNames,
    varNames,
  };
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function cleanSvgContent(raw: string, viewBox?: string): string {
  let svg = raw.trim();

  // Remove data-* attributes
  svg = svg.replace(/\s+data-[a-z-]+="[^"]*"/gi, '');

  // Ensure viewBox
  if (viewBox && !svg.includes('viewBox')) {
    svg = svg.replace('<svg', `<svg viewBox="${viewBox}"`);
  }

  // Add fill="currentColor" if no fill specified on root
  if (!svg.match(/<svg[^>]*fill=/)) {
    svg = svg.replace('<svg', '<svg fill="currentColor"');
  }

  return svg;
}

function deduplicateName(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}${counter}`)) {
    counter++;
  }
  return `${base}${counter}`;
}

// ---------------------------------------------------------------------------
// Font metric fallback generation
// ---------------------------------------------------------------------------

/**
 * Generates `@font-face` rules with `ascent-override`, `descent-override`,
 * `line-gap-override`, and `size-adjust` so a system fallback closely matches
 * the custom font's vertical metrics, reducing Cumulative Layout Shift.
 */
function buildFontMetricFallbacks(fonts: FontSpec[]): string[] {
  const lines: string[] = [];

  for (const font of fonts) {
    if (font.source === 'system') continue;

    // Find the first file with metrics.
    const fileWithMetrics = font.files.find((f) => f.metrics);
    if (!fileWithMetrics?.metrics) continue;

    const metrics = fileWithMetrics.metrics;
    const fallbackFamily = determineFallbackFamily(font);
    const safeName = font.family.replace(/['"]/g, '');

    lines.push(`@font-face {`);
    lines.push(`  font-family: '${safeName}-fallback';`);
    lines.push(`  src: local('${fallbackFamily}');`);
    lines.push(`  ascent-override: ${(metrics.ascent * 100).toFixed(2)}%;`);
    lines.push(`  descent-override: ${(Math.abs(metrics.descent) * 100).toFixed(2)}%;`);
    lines.push(`  line-gap-override: ${(metrics.lineGap * 100).toFixed(2)}%;`);
    lines.push(`  size-adjust: 100%;`);
    lines.push(`}`);
  }

  return lines;
}

/** Pick the most appropriate system fallback for override matching. */
function determineFallbackFamily(font: FontSpec): string {
  const lower = font.family.toLowerCase();

  // Monospace fonts
  if (
    lower.includes('mono') ||
    lower.includes('code') ||
    lower.includes('consolas') ||
    lower.includes('courier')
  ) {
    return 'Courier New';
  }

  // Serif fonts
  if (
    lower.includes('serif') ||
    lower.includes('georgia') ||
    lower.includes('playfair') ||
    lower.includes('merriweather') ||
    lower.includes('lora')
  ) {
    return 'Times New Roman';
  }

  // Default: sans-serif
  return 'Arial';
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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

function toJsVarName(family: string): string {
  const cleaned = family
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word, idx) =>
      idx === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');
  return cleaned || 'customFont';
}

function escapeCssString(value: string): string {
  // Ensure font family names with spaces are quoted in CSS
  return value;
}

function contrastForeground(bgColor: string): string {
  // Simple heuristic: if the color looks dark, use light foreground and vice versa
  const rgb = parseSimpleRgb(bgColor);
  if (!rgb) return 'oklch(0.985 0 0)';
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return luminance < 128 ? 'oklch(0.985 0 0)' : 'oklch(0.205 0 0)';
}

function parseSimpleRgb(
  color: string,
): { r: number; g: number; b: number } | null {
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
    return hslToSrgb(
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
    return oklchToSrgb(
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
    return labToSrgb(
      parseFloat(labMatch[1]),
      parseFloat(labMatch[2]),
      parseFloat(labMatch[3]),
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Color space conversions (foundation-local, for contrastForeground)
// ---------------------------------------------------------------------------

function hslToSrgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const sN = s / 100;
  const lN = l / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

function oklchToSrgb(
  l: number,
  c: number,
  h: number,
): { r: number; g: number; b: number } {
  const lN = l > 1 ? l / 100 : l;
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  const l_ = lN + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = lN - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = lN - 0.0894841775 * a - 1.2914855480 * b;
  const lr = l_ * l_ * l_;
  const mr = m_ * m_ * m_;
  const sr = s_ * s_ * s_;
  const toS = (v: number): number =>
    Math.round(Math.max(0, Math.min(255,
      v <= 0.0031308 ? v * 12.92 * 255 : (1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255,
    )));
  return {
    r: toS(4.0767416621 * lr - 3.3077115913 * mr + 0.2309699292 * sr),
    g: toS(-1.2684380046 * lr + 2.6097574011 * mr - 0.3413193965 * sr),
    b: toS(-0.0041960863 * lr - 0.7034186147 * mr + 1.7076147010 * sr),
  };
}

function labToSrgb(
  l: number,
  a: number,
  b: number,
): { r: number; g: number; b: number } {
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const delta = 6 / 29;
  const cube = (t: number): number =>
    t > delta ? t * t * t : 3 * delta * delta * (t - 4 / 29);
  const x = cube(fx) * 0.95047;
  const y = cube(fy) * 1.0;
  const z = cube(fz) * 1.08883;
  const rl = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gl = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const bl = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  const toS = (v: number): number =>
    Math.round(Math.max(0, Math.min(255,
      v <= 0.0031308 ? v * 12.92 * 255 : (1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255,
    )));
  return { r: toS(rl), g: toS(gl), b: toS(bl) };
}

function collectKeyframeAnimations(pageData: PageData): AnimationSpec[] {
  const result: AnimationSpec[] = [];
  for (const section of pageData.sections) {
    for (const anim of section.animations) {
      if (
        anim.type === 'css-animation' &&
        anim.keyframes &&
        anim.keyframes.length > 0
      ) {
        result.push(anim);
      }
    }
  }
  return result;
}

function sanitizeAnimationName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
