/**
 * Harvest the in-document icon sprite from the crawl state DOMs.
 *
 * ClickUp renders icons as `<use xlink:href="#cu3-icon-search">` that resolve
 * against `<symbol id="cu3-icon-search">` defs living in an in-document sprite
 * (`<cu3-icons>` / `<cu3-icons-lazy>`). The sprite sits OUTSIDE the content
 * region the shell/content split keeps, so the emit drops it and every `<use>`
 * renders blank.
 *
 * Different captured states register different subsets of symbols (the sprite
 * is lazy-populated as routes mount), so a single state is never complete. We
 * scan EVERY state DOM (states/state-XXXX/dom.html), take the UNION of every
 * `<symbol id="cu3-icon-...">` def
 * defs (dedupe by id, first writer wins), and pack them into ONE hidden sprite
 * `<svg>` to inject at the top of the cloned `<body>`. That maximises the set of
 * `<use>` refs that resolve across the whole app.
 *
 * Symbols whose defs never appear in any captured DOM (ClickUp injects some via
 * runtime JS that the crawler truncated) cannot be recovered here; those `<use>`
 * refs stay blank, which is the capture's ceiling, not a bug in this pass.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SPRITE_OPEN =
  '<svg aria-hidden="true" data-dr-parity-sprite="1" ' +
  'style="position:absolute;width:0;height:0;overflow:hidden">';
const SPRITE_CLOSE = '</svg>';

const SYMBOL_ID_RE = /<symbol\b[^>]*\bid="(cu3-icon-[^"]+)"/;

export interface SpriteHarvestResult {
  /** The hidden sprite `<svg>` markup, or '' when no symbols were found. */
  spriteSvg: string;
  /** Count of unique `<symbol>` defs packed into the sprite. */
  symbolCount: number;
  /** Number of state DOMs scanned. */
  statesScanned: number;
}

/**
 * Extract every `<symbol id="cu3-icon-...">...</symbol>` block from one DOM
 * string by scanning for balanced open/close pairs. Cheerio would lower-case
 * camelCase ids and re-serialise the SVG inner markup, so a verbatim text scan
 * preserves the symbols' inner paths exactly.
 */
function extractSymbols(html: string, into: Map<string, string>): void {
  const OPEN = '<symbol';
  const CLOSE = '</symbol>';
  let cursor = 0;
  while (true) {
    const start = html.indexOf(OPEN, cursor);
    if (start < 0) break;
    const end = html.indexOf(CLOSE, start);
    if (end < 0) break;
    const block = html.slice(start, end + CLOSE.length);
    cursor = end + CLOSE.length;

    const idMatch = SYMBOL_ID_RE.exec(block);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (!into.has(id)) into.set(id, block);
  }
}

/** List the `states/state-XXXX/dom.html` files under a crawl directory. */
function listStateDoms(crawlDir: string): string[] {
  const statesDir = join(crawlDir, 'states');
  if (!existsSync(statesDir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(statesDir)) {
    const domPath = join(statesDir, entry, 'dom.html');
    if (existsSync(domPath)) out.push(domPath);
  }
  return out;
}

export function harvestSprite(crawlDir: string): SpriteHarvestResult {
  const domPaths = listStateDoms(crawlDir);
  const symbols = new Map<string, string>();

  for (const domPath of domPaths) {
    let html: string;
    try {
      html = readFileSync(domPath, 'utf8');
    } catch {
      continue;
    }
    extractSymbols(html, symbols);
  }

  if (symbols.size === 0) {
    return { spriteSvg: '', symbolCount: 0, statesScanned: domPaths.length };
  }

  const spriteSvg = `${SPRITE_OPEN}${[...symbols.values()].join('')}${SPRITE_CLOSE}`;
  return { spriteSvg, symbolCount: symbols.size, statesScanned: domPaths.length };
}
