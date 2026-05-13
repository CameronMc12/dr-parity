/**
 * Emits the `:root { ... }` block from DesignTokens.cssVariables.
 *
 * Hex / rgb values live ONLY here. Components must reference them via var(--token-name).
 */

import type { DesignTokens } from '../../types/component';

export interface TokensCssResult {
  /** The `:root { ... }` block including braces. */
  rootBlock: string;
  /** Best-guess sans / mono / display token names (without `var(...)`) for body styling. */
  primaryFontVar: string;
  primaryBgVar: string;
  primaryFgVar: string;
}

export function buildTokensCss(tokens: DesignTokens): TokensCssResult {
  const lines: string[] = [':root {'];

  // Stable token order: fonts → colors → spacing → radius → shadow → other
  const entries = Object.entries(tokens.cssVariables);
  const buckets: Record<string, [string, string][]> = {
    font: [],
    color: [],
    spacing: [],
    radius: [],
    shadow: [],
    other: [],
  };

  for (const [name, value] of entries) {
    if (name.startsWith('--font-')) buckets.font.push([name, value]);
    else if (name.startsWith('--color-') || name.startsWith('--gradient-')) buckets.color.push([name, value]);
    else if (name.startsWith('--spacing-')) buckets.spacing.push([name, value]);
    else if (name.startsWith('--radius')) buckets.radius.push([name, value]);
    else if (name.startsWith('--shadow-')) buckets.shadow.push([name, value]);
    else buckets.other.push([name, value]);
  }

  // Always inject semantic aliases so component CSS can rely on stable names.
  // Hex values from the design tokens become the *only* place hex appears.
  const semantic: [string, string][] = [];
  semantic.push(['--paper', tokens.colors.background.value]);
  semantic.push(['--dark', tokens.colors.foreground.value]);
  semantic.push(['--primary', tokens.colors.primary.value]);
  semantic.push(['--muted', tokens.colors.muted.value]);
  semantic.push(['--border', tokens.colors.border.value]);
  if (tokens.colors.accent) semantic.push(['--accent', tokens.colors.accent.value]);
  if (tokens.colors.secondary) semantic.push(['--secondary', tokens.colors.secondary.value]);

  // Font role aliases (display / sans / mono) — chosen from typography scale
  const sans = tokens.typography.fontFamilies.sans;
  const mono = tokens.typography.fontFamilies.mono;
  const serif = tokens.typography.fontFamilies.serif;
  semantic.push(['--sans', quoteFontStack(sans)]);
  semantic.push(['--mono', quoteFontStack(mono)]);
  semantic.push(['--display', quoteFontStack(serif ?? sans)]);

  for (const [n, v] of semantic) lines.push(`  ${n}: ${v};`);

  const sectionOrder: (keyof typeof buckets)[] = ['font', 'color', 'spacing', 'radius', 'shadow', 'other'];
  for (const key of sectionOrder) {
    const rows = buckets[key];
    if (rows.length === 0) continue;
    lines.push(`  /* ${key} tokens */`);
    for (const [n, v] of rows) lines.push(`  ${n}: ${v};`);
  }

  lines.push('}');

  return {
    rootBlock: lines.join('\n'),
    primaryFontVar: '--sans',
    primaryBgVar: '--paper',
    primaryFgVar: '--dark',
  };
}

function quoteFontStack(stack: string): string {
  // Add quotes around multi-word family names while preserving fallbacks.
  return stack
    .split(',')
    .map((part) => {
      const trimmed = part.trim().replace(/^["']|["']$/g, '');
      if (/\s/.test(trimmed) && !/^(sans-serif|serif|monospace|system-ui)$/i.test(trimmed)) {
        return `"${trimmed}"`;
      }
      return trimmed;
    })
    .join(', ');
}
