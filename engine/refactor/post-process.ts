const COMPONENT_PLACEHOLDER_TAG = 'dr-parity-component';
const ICON_PLACEHOLDER_TAG = 'dr-parity-icon';

export const PLACEHOLDER_COMPONENT_TAG = COMPONENT_PLACEHOLDER_TAG;
export const PLACEHOLDER_ICON_TAG = ICON_PLACEHOLDER_TAG;

export const PLACEHOLDER_COMPONENT_ATTR = 'data-dr-parity-component';
export const PLACEHOLDER_ICON_ATTR = 'data-dr-parity-icon';
export const PLACEHOLDER_SELF_CLOSE_ATTR = 'data-dr-parity-self-close';

interface ParsedAttr {
  name: string;
  value: string | null;
  hasEq: boolean;
  quote: '"' | "'" | '';
}

interface ParsedTag {
  attrs: ParsedAttr[];
  selfClose: boolean;
}

function isPascalIdent(value: string): boolean {
  return /^[A-Z][A-Za-z0-9_]*$/.test(value);
}

function parseAttrs(source: string): ParsedAttr[] {
  const attrs: ParsedAttr[] = [];
  let i = 0;
  const len = source.length;
  while (i < len) {
    while (i < len && /\s/.test(source[i])) i += 1;
    if (i >= len) break;
    const nameStart = i;
    while (i < len && !/[\s=>/]/.test(source[i])) i += 1;
    if (i === nameStart) {
      i += 1;
      continue;
    }
    const name = source.slice(nameStart, i);
    while (i < len && /\s/.test(source[i])) i += 1;
    if (source[i] === '=') {
      i += 1;
      while (i < len && /\s/.test(source[i])) i += 1;
      const ch = source[i];
      if (ch === '"' || ch === "'") {
        const quote = ch;
        i += 1;
        const valStart = i;
        while (i < len && source[i] !== quote) i += 1;
        const value = source.slice(valStart, i);
        if (i < len) i += 1;
        attrs.push({ name, value, hasEq: true, quote });
      } else {
        const valStart = i;
        while (i < len && !/[\s>]/.test(source[i])) i += 1;
        const value = source.slice(valStart, i);
        attrs.push({ name, value, hasEq: true, quote: '' });
      }
    } else {
      attrs.push({ name, value: null, hasEq: false, quote: '' });
    }
  }
  return attrs;
}

function renderAttrs(attrs: ParsedAttr[]): string {
  const parts: string[] = [];
  for (const attr of attrs) {
    if (!attr.hasEq) {
      parts.push(attr.name);
      continue;
    }
    const value = attr.value ?? '';
    const quote = attr.quote === "'" ? "'" : '"';
    parts.push(`${attr.name}=${quote}${value}${quote}`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

function extractMarker(
  attrs: ParsedAttr[],
  markerAttr: string,
): { componentName: string | null; selfClose: boolean; rest: ParsedAttr[] } {
  const lower = markerAttr.toLowerCase();
  const selfCloseLower = PLACEHOLDER_SELF_CLOSE_ATTR.toLowerCase();
  let componentName: string | null = null;
  let selfClose = false;
  const rest: ParsedAttr[] = [];
  for (const attr of attrs) {
    if (attr.name.toLowerCase() === lower) {
      if (attr.value !== null && isPascalIdent(attr.value)) {
        componentName = attr.value;
      }
      continue;
    }
    if (attr.name.toLowerCase() === selfCloseLower) {
      selfClose = true;
      continue;
    }
    rest.push(attr);
  }
  return { componentName, selfClose, rest };
}

interface TokenIndex {
  index: number;
  end: number;
  raw: string;
  kind: 'open' | 'close';
  tagName: string;
  parsed: ParsedTag | null;
}

function findNextPlaceholderToken(html: string, from: number): TokenIndex | null {
  const lower = html.toLowerCase();
  let cursor = from;
  while (cursor < html.length) {
    const open = lower.indexOf('<', cursor);
    if (open === -1) return null;
    const after = lower[open + 1];
    if (after === '!' || after === '?') {
      cursor = open + 1;
      continue;
    }
    const isClose = after === '/';
    const nameStart = open + (isClose ? 2 : 1);
    let nameEnd = nameStart;
    while (
      nameEnd < lower.length &&
      !/[\s/>]/.test(lower[nameEnd])
    ) {
      nameEnd += 1;
    }
    const tagName = lower.slice(nameStart, nameEnd);
    if (tagName !== COMPONENT_PLACEHOLDER_TAG && tagName !== ICON_PLACEHOLDER_TAG) {
      cursor = open + 1;
      continue;
    }
    const endIdx = html.indexOf('>', nameEnd);
    if (endIdx === -1) return null;
    const inside = html.slice(nameEnd, endIdx);
    const selfClose = inside.trimEnd().endsWith('/');
    const attrSource = selfClose
      ? inside.slice(0, inside.lastIndexOf('/'))
      : inside;
    const parsed: ParsedTag | null = isClose
      ? null
      : { attrs: parseAttrs(attrSource), selfClose };
    return {
      index: open,
      end: endIdx + 1,
      raw: html.slice(open, endIdx + 1),
      kind: isClose ? 'close' : 'open',
      tagName,
      parsed,
    };
  }
  return null;
}

interface StackFrame {
  tagName: string;
  componentName: string;
  emittedSelfClose: boolean;
}

export function rewritePlaceholders(html: string): string {
  let out = '';
  let cursor = 0;
  const stack: StackFrame[] = [];

  while (cursor < html.length) {
    const token = findNextPlaceholderToken(html, cursor);
    if (!token) {
      out += html.slice(cursor);
      break;
    }
    out += html.slice(cursor, token.index);

    if (token.kind === 'open' && token.parsed) {
      const markerAttr =
        token.tagName === COMPONENT_PLACEHOLDER_TAG
          ? PLACEHOLDER_COMPONENT_ATTR
          : PLACEHOLDER_ICON_ATTR;
      const { componentName, selfClose, rest } = extractMarker(
        token.parsed.attrs,
        markerAttr,
      );
      if (!componentName) {
        out += token.raw;
        cursor = token.end;
        continue;
      }
      const attrString = renderAttrs(rest);
      const wantsSelfClose =
        token.parsed.selfClose ||
        selfClose ||
        token.tagName === ICON_PLACEHOLDER_TAG;
      if (wantsSelfClose) {
        out += `<${componentName}${attrString} />`;
        if (!token.parsed.selfClose) {
          stack.push({
            tagName: token.tagName,
            componentName,
            emittedSelfClose: true,
          });
        }
      } else {
        out += `<${componentName}${attrString}>`;
        stack.push({
          tagName: token.tagName,
          componentName,
          emittedSelfClose: false,
        });
      }
      cursor = token.end;
      continue;
    }

    if (token.kind === 'close') {
      let frame: StackFrame | undefined;
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tagName === token.tagName) {
          frame = stack[i];
          stack.splice(i, 1);
          break;
        }
      }
      if (frame) {
        if (!frame.emittedSelfClose) {
          out += `</${frame.componentName}>`;
        }
      } else {
        out += token.raw;
      }
      cursor = token.end;
      continue;
    }

    out += token.raw;
    cursor = token.end;
  }

  return out;
}
