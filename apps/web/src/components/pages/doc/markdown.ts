/**
 * Lightweight markdown parser for ClickUp doc bodies. No external dependency —
 * the captured content is plain markdown (headings, bold/italic, images, links,
 * lists, ordered lists, checklists, blockquotes, dividers, inline + fenced code,
 * tables). Parses to a typed block AST consumed by `MarkdownBody`.
 *
 * Deliberately small: it covers exactly the syntax present in the crawled docs
 * plus the few block kinds ClickUp docs commonly use (checklist / divider / code
 * fence). It is forgiving — unknown lines fall through as paragraph text.
 */

export type InlineNode =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; children: InlineNode[] }
  | { kind: 'italic'; children: InlineNode[] }
  | { kind: 'code'; value: string }
  | { kind: 'link'; href: string; children: InlineNode[] }
  | { kind: 'image'; src: string; alt: string };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; inline: InlineNode[] }
  | { type: 'paragraph'; inline: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'checklist'; items: { checked: boolean; inline: InlineNode[] }[] }
  | { type: 'quote'; inline: InlineNode[] }
  | { type: 'divider' }
  | { type: 'code'; value: string }
  | { type: 'table'; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: 'image'; src: string; alt: string };

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const CHECK_RE = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const UL_RE = /^[-*]\s+(.*)$/;
const OL_RE = /^(\d+)\.\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const HR_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const IMG_ONLY_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const TABLE_DIV_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

/**
 * Unescape ClickUp's bracket escaping. The export emits `\[Answer\]` for literal
 * square brackets; our inline link regex (correctly) won't match those, so they
 * would otherwise render verbatim including the backslashes. Strip the escape so
 * the user sees `[Answer]`.
 */
function unescapeBrackets(src: string): string {
  return src.replace(/\\\[/g, '[').replace(/\\\]/g, ']');
}

/** Split a markdown document into a flat block list. */
export function parseMarkdown(src: string): Block[] {
  const lines = unescapeBrackets(src).replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  const at = (idx: number): string => lines[idx] ?? '';

  while (i < lines.length) {
    const trimmed = at(i).trim();

    if (trimmed === '') {
      i += 1;
      continue;
    }

    // Fenced code block.
    if (trimmed.startsWith('```')) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !at(i).trim().startsWith('```')) {
        code.push(at(i));
        i += 1;
      }
      i += 1; // consume closing fence
      blocks.push({ type: 'code', value: code.join('\n') });
      continue;
    }

    if (HR_RE.test(trimmed)) {
      blocks.push({ type: 'divider' });
      i += 1;
      continue;
    }

    const heading = HEADING_RE.exec(trimmed);
    if (heading) {
      const level = (heading[1] ?? '#').length as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, inline: parseInline(heading[2] ?? '') });
      i += 1;
      continue;
    }

    const imgOnly = IMG_ONLY_RE.exec(trimmed);
    if (imgOnly) {
      blocks.push({ type: 'image', alt: imgOnly[1] ?? '', src: imgOnly[2] ?? '' });
      i += 1;
      continue;
    }

    // Table: a pipe row followed by a divider row.
    if (trimmed.startsWith('|') && TABLE_DIV_RE.test(at(i + 1).trim())) {
      const header = splitTableRow(trimmed);
      const rows: InlineNode[][][] = [];
      i += 2; // header + divider
      while (i < lines.length && at(i).trim().startsWith('|')) {
        rows.push(splitTableRow(at(i).trim()));
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // Checklist run (must precede plain unordered list).
    if (CHECK_RE.test(trimmed)) {
      const items: { checked: boolean; inline: InlineNode[] }[] = [];
      while (i < lines.length) {
        const m = CHECK_RE.exec(at(i).trim());
        if (!m) break;
        items.push({
          checked: (m[1] ?? '').toLowerCase() === 'x',
          inline: parseInline(m[2] ?? ''),
        });
        i += 1;
      }
      blocks.push({ type: 'checklist', items });
      continue;
    }

    // Ordered list run.
    if (OL_RE.test(trimmed)) {
      const items: InlineNode[][] = [];
      while (i < lines.length) {
        const m = OL_RE.exec(at(i).trim());
        if (!m) break;
        items.push(parseInline(m[2] ?? ''));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Unordered list run.
    if (UL_RE.test(trimmed)) {
      const items: InlineNode[][] = [];
      while (i < lines.length) {
        const t = at(i).trim();
        const m = UL_RE.exec(t);
        if (!m || CHECK_RE.test(t)) break;
        items.push(parseInline(m[1] ?? ''));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Blockquote run (joined into one quote block).
    if (QUOTE_RE.test(trimmed)) {
      const parts: string[] = [];
      while (i < lines.length) {
        const m = QUOTE_RE.exec(at(i).trim());
        if (!m) break;
        parts.push(m[1] ?? '');
        i += 1;
      }
      blocks.push({ type: 'quote', inline: parseInline(parts.join(' ')) });
      continue;
    }

    // Paragraph: a single source line (ClickUp export is one block per line).
    blocks.push({ type: 'paragraph', inline: parseInline(trimmed) });
    i += 1;
  }

  return blocks;
}

function splitTableRow(row: string): InlineNode[][] {
  return row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => parseInline(cell.trim()));
}

const INLINE_RE =
  /(!\[[^\]]*\]\([^)]+\))|(\[[^\]]*\]\([^)]+\))|(\*\*[^*]+\*\*)|(_[^_]+_)|(\*[^*]+\*)|(`[^`]+`)/;

/** Tokenize inline markdown (bold, italic, code, links, images). */
export function parseInline(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let rest = src;

  while (rest.length > 0) {
    const m = INLINE_RE.exec(rest);
    const token = m?.[0];
    if (!m || token === undefined) {
      out.push({ kind: 'text', value: rest });
      break;
    }
    if (m.index > 0) {
      out.push({ kind: 'text', value: rest.slice(0, m.index) });
    }

    if (token.startsWith('![')) {
      const im = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
      if (im) out.push({ kind: 'image', alt: im[1] ?? '', src: im[2] ?? '' });
    } else if (token.startsWith('[')) {
      const lm = /^\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
      if (lm) out.push({ kind: 'link', href: lm[2] ?? '', children: parseInline(lm[1] ?? '') });
    } else if (token.startsWith('**')) {
      out.push({ kind: 'bold', children: parseInline(token.slice(2, -2)) });
    } else if (token.startsWith('`')) {
      out.push({ kind: 'code', value: token.slice(1, -1) });
    } else {
      // _italic_ or *italic*
      out.push({ kind: 'italic', children: parseInline(token.slice(1, -1)) });
    }

    rest = rest.slice(m.index + token.length);
  }

  return out;
}
