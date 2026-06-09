import { createHash } from 'node:crypto';
import type { CollectedSheet } from './css-collect';

/**
 * Hard ceiling on total injected CSS. ClickUp's full sheet set is ~1.8MB; this
 * cap keeps a runaway page (hundreds of inline sheets) from bloating a snapshot
 * without amputating the real stylesheets. When exceeded, later sheets are
 * dropped and a truncation marker is appended.
 */
export const MAX_TOTAL_CSS_BYTES = 6 * 1024 * 1024;

export type InjectResult = {
  html: string;
  injectedCount: number;
  skippedDuplicates: number;
  truncated: boolean;
  totalBytes: number;
};

function sha8(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Builds ordered `<style data-parity-sheet="...">` blocks from collected sheets,
 * preserving cascade order. De-dupes identical sheets by content hash and caps
 * total size. Pure: returns the block string plus stats, no DOM dependency.
 */
export function buildStyleBlocks(sheets: CollectedSheet[]): {
  blocks: string;
  injectedCount: number;
  skippedDuplicates: number;
  truncated: boolean;
  totalBytes: number;
} {
  const seen = new Set<string>();
  const out: string[] = [];
  let injectedCount = 0;
  let skippedDuplicates = 0;
  let totalBytes = 0;
  let truncated = false;

  for (const sheet of sheets) {
    const text = sheet.text ?? '';
    if (!text.trim()) continue;
    const hash = sha8(text);
    if (seen.has(hash)) {
      skippedDuplicates += 1;
      continue;
    }
    const size = Buffer.byteLength(text, 'utf8');
    if (totalBytes + size > MAX_TOTAL_CSS_BYTES) {
      truncated = true;
      break;
    }
    seen.add(hash);
    totalBytes += size;
    injectedCount += 1;
    const label = sheet.href ?? `inline:${hash}`;
    out.push(
      `<style data-parity-sheet="${escapeAttr(label)}" data-parity-kind="${sheet.kind}">\n${text}\n</style>`,
    );
  }

  if (truncated) {
    out.push(
      `<!-- parity: CSS truncated at ${MAX_TOTAL_CSS_BYTES} bytes; remaining sheets omitted -->`,
    );
  }

  return {
    blocks: out.join('\n'),
    injectedCount,
    skippedDuplicates,
    truncated,
    totalBytes,
  };
}

/**
 * Injects the style blocks into the captured HTML's `<head>`, AFTER any existing
 * head content so collected sheets win the cascade over earlier `<link>`/inline
 * styles (mirroring how the live page resolved them last). Falls back to
 * prepending `<head>` or, lacking one, the document start.
 */
export function injectStyles(html: string, sheets: CollectedSheet[]): InjectResult {
  const built = buildStyleBlocks(sheets);
  const marker = `\n<!-- parity-stylesheets: ${built.injectedCount} sheets, ${built.totalBytes} bytes -->\n${built.blocks}\n`;

  let injected: string;
  if (/<\/head>/i.test(html)) {
    injected = html.replace(/<\/head>/i, `${marker}</head>`);
  } else if (/<head[^>]*>/i.test(html)) {
    injected = html.replace(/<head[^>]*>/i, (m) => `${m}${marker}`);
  } else {
    injected = `${marker}${html}`;
  }

  return {
    html: injected,
    injectedCount: built.injectedCount,
    skippedDuplicates: built.skippedDuplicates,
    truncated: built.truncated,
    totalBytes: built.totalBytes,
  };
}

/**
 * Offline fallback / test helper. Reconstructs `CollectedSheet[]` from parsed
 * network.jsonl `response` records (kind === 'response', url ends in .css, has
 * body). Used when the runtime collection comes back empty, and to unit-test the
 * merge + ordering logic against real captured bodies without a live browser.
 */
export type NetworkResponse = {
  kind?: string;
  url?: string;
  body?: string;
  bodyEncoding?: string;
};

export function sheetsFromNetwork(records: NetworkResponse[]): CollectedSheet[] {
  const sheets: CollectedSheet[] = [];
  const seenUrl = new Set<string>();
  for (const rec of records) {
    if (rec.kind !== 'response') continue;
    const url = rec.url ?? '';
    if (!/\.css(\?|$)/i.test(url)) continue;
    if (!rec.body) continue;
    if (seenUrl.has(url)) continue;
    seenUrl.add(url);
    const text = rec.bodyEncoding === 'base64' ? Buffer.from(rec.body, 'base64').toString('utf8') : rec.body;
    sheets.push({ href: url, text, kind: 'fetch' });
  }
  return sheets;
}
