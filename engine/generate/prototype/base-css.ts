/**
 * Base resets, body styling, and the `.num` / `.mono` utility classes the
 * spec requires for numeric content.
 */

export function buildBaseCss(): string {
  return [
    '* { box-sizing: border-box; }',
    'html, body { margin: 0; padding: 0; font-family: var(--sans); background: var(--paper); color: var(--dark); }',
    'img, svg, video { max-width: 100%; display: block; }',
    'a { color: inherit; text-decoration: none; }',
    'button { font: inherit; cursor: pointer; }',
    '',
    'h1, h2, h3, h4, h5, h6 { font-family: var(--display); margin: 0; line-height: 1.15; }',
    'p { margin: 0; line-height: 1.5; }',
    '',
    '/* Three type roles: display headings, body prose, mono for data */',
    '.num, .mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }',
    '',
    '/* Tables: text left, numbers right (apply .num to <td> for numerics) */',
    'table { border-collapse: collapse; width: 100%; }',
    'th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }',
    'th.num, td.num { text-align: right; }',
    '',
    '/* App shell */',
    '.app { min-height: 100vh; display: flex; flex-direction: column; }',
  ].join('\n');
}
