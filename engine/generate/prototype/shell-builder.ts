/**
 * Builds the `<design-name>.html` shell — the entry document the user
 * double-clicks to run the prototype.
 */

import type { FontSpec } from '../../types/extraction';

export interface ShellOptions {
  designName: string;
  /** Combined CSS: tokens :root block + base resets + per-component rules. */
  inlineCss: string;
  /** Slugs of every view-<slug>.jsx in declared order. */
  viewSlugs: string[];
  /** Whether chrome.jsx was emitted. */
  hasChrome: boolean;
  /** Fonts to preload from Google Fonts; falls back to nothing when empty. */
  fonts: FontSpec[];
}

export function buildShellHtml(options: ShellOptions): string {
  const { designName, inlineCss, viewSlugs, hasChrome, fonts } = options;
  const googleFontHref = buildGoogleFontsHref(fonts);

  const fontLinks = googleFontHref
    ? [
        '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
        `  <link href="${googleFontHref}" rel="stylesheet" />`,
      ]
    : ['  <!-- No Google Fonts detected -->'];

  const viewScriptTags = viewSlugs
    .map((slug) => `  <script type="text/babel" src="view-${slug}.jsx"></script>`)
    .join('\n');

  const chromeScript = hasChrome
    ? '  <script type="text/babel" src="chrome.jsx"></script>'
    : '  <script type="text/babel">/* chrome.jsx not generated */ window.Chrome = ({children}) => children;</script>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(designName)}</title>
${fontLinks.join('\n')}
  <style>
${indent(inlineCss, 4)}
  </style>
</head>
<body>
  <div id="root"></div>
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>
  <script type="text/babel" src="data.jsx"></script>
${chromeScript}
${viewScriptTags}
  <script type="text/babel" src="app.jsx"></script>
</body>
</html>
`;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((l) => (l ? pad + l : l)).join('\n');
}
