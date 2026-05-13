/**
 * Emits `src/layouts/BaseLayout.astro` — the HTML shell shared by every page.
 *
 * Responsibilities:
 *  - <head>: meta, title, favicon
 *  - Google Fonts <link>s when fonts.source === 'google'
 *  - imports tokens.css and base.css globally (Astro injects them at build)
 *  - mounts <slot /> for page contents
 *  - includes the GSAP animations entry script via Astro's <script> tag (Astro
 *    will bundle and ship it).
 */

import type { FontSpec, PageData } from '../../types/extraction';

export interface LayoutOptions {
  pageData: PageData;
  designName: string;
}

export function buildBaseLayout(options: LayoutOptions): string {
  const { pageData, designName } = options;
  const title = pageData.title || designName;
  const description = pageData.description || '';
  const googleHref = buildGoogleFontsHref(pageData.fonts);

  const fontLinks = googleHref
    ? [
        '    <link rel="preconnect" href="https://fonts.googleapis.com" />',
        '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
        `    <link href="${googleHref}" rel="stylesheet" />`,
      ]
    : ['    <!-- No Google Fonts detected -->'];

  return [
    '---',
    "import '../styles/tokens.css';",
    "import '../styles/base.css';",
    '',
    'export interface Props {',
    '  title?: string;',
    '  description?: string;',
    '}',
    '',
    'const {',
    `  title = ${JSON.stringify(title)},`,
    `  description = ${JSON.stringify(description)},`,
    '} = Astro.props;',
    '---',
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <meta name="description" content={description} />',
    '    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    '    <title>{title}</title>',
    ...fontLinks,
    '  </head>',
    '  <body>',
    '    <slot />',
    "    <script>",
    "      import '../scripts/animations.ts';",
    '    </script>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}

function buildGoogleFontsHref(fonts: FontSpec[]): string | null {
  const googleFonts = fonts.filter((f) => f.source === 'google');
  if (googleFonts.length === 0) return null;

  const families = googleFonts.map((f) => {
    const weights = (f.weights.length > 0 ? f.weights : [400, 700])
      .filter((w) => Number.isFinite(w))
      .slice(0, 6)
      .join(';');
    const family = f.family.replace(/\s+/g, '+');
    return `family=${family}:wght@${weights}`;
  });

  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}
