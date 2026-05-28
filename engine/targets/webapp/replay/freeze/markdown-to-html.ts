/**
 * Minimal dependency-free Markdown → HTML converter for the doc-freezer shim.
 *
 * Scope: handles the tokens the public Docs API actually emits — headings,
 * bold/italic, lists, code, links, paragraphs, line breaks. Complex blocks
 * (tables, images with sizing, embeds, mentions) are rendered as escaped
 * text inside a paragraph; the goal is "readable text in the editor", not
 * pixel-perfect Markdown rendering.
 *
 * This module is exported in TWO forms:
 *   1. `markdownToHtml(md: string): string` — callable from Node at build time
 *      (e.g. for the offline pages-loader check).
 *   2. `MARKDOWN_TO_HTML_SOURCE` — the same logic stringified for inlining
 *      into the boot-shim JS that runs in the cloned page. Browser scope is
 *      sandboxed: no Node deps, no template literals, no optional chaining,
 *      to maximise compatibility with very old bundler-emitted environments.
 */

/** Escape HTML-special chars so user text never injects markup. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Apply inline formatting (bold, italic, code, links) to escaped text. */
function applyInlineFormatting(text: string): string {
  let out = text;
  // Inline code (must run before bold/italic so the contents are not parsed)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold: **x** or __x__
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic: *x* or _x_
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/(^|[^\w])_([^_]+)_(?=$|[^\w])/g, '$1<em>$2</em>');
  // Links: [text](url) — note: url and text are already HTML-escaped
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return out;
}

/**
 * Convert Markdown to safe HTML. Block-level parser with line buffering for
 * lists, paragraphs, and fenced code. Unknown blocks fall through as escaped
 * paragraphs so no input is ever lost.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '<p><br></p>';

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  let i = 0;
  let listType: 'ul' | 'ol' | null = null;
  let paragraphBuf: string[] = [];

  function flushParagraph(): void {
    if (paragraphBuf.length === 0) return;
    const joined = paragraphBuf.map((l) => applyInlineFormatting(escapeHtml(l))).join('<br>');
    out.push('<p class="ql-block">' + joined + '</p>');
    paragraphBuf = [];
  }

  function closeList(): void {
    if (!listType) return;
    out.push('</' + listType + '>');
    listType = null;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, '');

    // Blank line: flush paragraph, close any open list.
    if (line.trim() === '') {
      flushParagraph();
      closeList();
      i++;
      continue;
    }

    // Fenced code block.
    if (/^```/.test(line)) {
      flushParagraph();
      closeList();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      out.push('<pre class="ql-block"><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
      if (i < lines.length) i++; // skip closing fence
      continue;
    }

    // Heading.
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      const content = applyInlineFormatting(escapeHtml(headingMatch[2]));
      out.push('<h' + level + ' class="ql-block">' + content + '</h' + level + '>');
      i++;
      continue;
    }

    // Unordered list item.
    const ulMatch = /^[-*]\s+(.+)$/.exec(line);
    if (ulMatch) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push('<li class="ql-block">' + applyInlineFormatting(escapeHtml(ulMatch[1])) + '</li>');
      i++;
      continue;
    }

    // Ordered list item.
    const olMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (olMatch) {
      flushParagraph();
      if (listType !== 'ol') {
        closeList();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push('<li class="ql-block">' + applyInlineFormatting(escapeHtml(olMatch[1])) + '</li>');
      i++;
      continue;
    }

    // Default: accumulate into paragraph buffer (joined with <br>).
    closeList();
    paragraphBuf.push(line);
    i++;
  }

  flushParagraph();
  closeList();

  return out.join('\n');
}

/**
 * The same conversion logic, stringified for inlining into the boot-shim JS.
 *
 * Deliberately ES5-ish (no template literals, no optional chaining, no
 * arrow-only functions in hot paths) so the emitted shim runs in any modern
 * browser without a transpile step.
 */
export const MARKDOWN_TO_HTML_SOURCE = `
function __df_escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function __df_inline(text) {
  var t = text;
  t = t.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
  t = t.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  t = t.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
  t = t.replace(/(^|[^\\w])_([^_]+)_(?=$|[^\\w])/g, '$1<em>$2</em>');
  t = t.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return t;
}
function __df_markdownToHtml(md) {
  if (!md) return '<p><br></p>';
  var lines = String(md).replace(/\\r\\n/g, '\\n').split('\\n');
  var out = [];
  var listType = null;
  var pbuf = [];
  function flushP() {
    if (pbuf.length === 0) return;
    var joined = pbuf.map(function(l) { return __df_inline(__df_escapeHtml(l)); }).join('<br>');
    out.push('<p class="ql-block">' + joined + '</p>');
    pbuf = [];
  }
  function closeList() {
    if (!listType) return;
    out.push('</' + listType + '>');
    listType = null;
  }
  var i = 0;
  while (i < lines.length) {
    var raw = lines[i];
    var line = raw.replace(/\\s+$/, '');
    if (line.trim() === '') { flushP(); closeList(); i++; continue; }
    if (/^\`\`\`/.test(line)) {
      flushP(); closeList(); i++;
      var codeLines = [];
      while (i < lines.length && !/^\`\`\`/.test(lines[i])) { codeLines.push(lines[i]); i++; }
      out.push('<pre class="ql-block"><code>' + __df_escapeHtml(codeLines.join('\\n')) + '</code></pre>');
      if (i < lines.length) i++;
      continue;
    }
    var hm = /^(#{1,6})\\s+(.*)$/.exec(line);
    if (hm) {
      flushP(); closeList();
      var lvl = hm[1].length;
      out.push('<h' + lvl + ' class="ql-block">' + __df_inline(__df_escapeHtml(hm[2])) + '</h' + lvl + '>');
      i++; continue;
    }
    var ul = /^[-*]\\s+(.+)$/.exec(line);
    if (ul) {
      flushP();
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
      out.push('<li class="ql-block">' + __df_inline(__df_escapeHtml(ul[1])) + '</li>');
      i++; continue;
    }
    var ol = /^\\d+\\.\\s+(.+)$/.exec(line);
    if (ol) {
      flushP();
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
      out.push('<li class="ql-block">' + __df_inline(__df_escapeHtml(ol[1])) + '</li>');
      i++; continue;
    }
    closeList();
    pbuf.push(line);
    i++;
  }
  flushP(); closeList();
  return out.join('\\n');
}
`;
