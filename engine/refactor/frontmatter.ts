import type { FrontmatterSplit } from './types';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export const REFACTOR_MARKER = '// dr-parity:refactored';
export const REFACTOR_HTML_MARKER = '<!-- dr-parity:refactored -->';

export function hasRefactorMarker(content: string): boolean {
  return content.includes(REFACTOR_MARKER) || content.includes(REFACTOR_HTML_MARKER);
}

export function splitFrontmatter(content: string): FrontmatterSplit {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: null, body: content };
  }
  const frontmatter = match[1];
  const body = content.slice(match[0].length);
  return { frontmatter, body };
}

interface ExistingImport {
  raw: string;
  names: string[];
  source: string;
}

function parseExistingImports(frontmatter: string): ExistingImport[] {
  const results: ExistingImport[] = [];
  const re = /import\s+(?:(\w+)|\{\s*([^}]+)\s*\}|(\w+)\s*,\s*\{\s*([^}]+)\s*\})\s+from\s+['"]([^'"]+)['"]\s*;?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(frontmatter)) !== null) {
    const names: string[] = [];
    if (m[1]) names.push(m[1]);
    if (m[2]) names.push(...m[2].split(',').map((s) => s.trim()).filter(Boolean));
    if (m[3]) names.push(m[3]);
    if (m[4]) names.push(...m[4].split(',').map((s) => s.trim()).filter(Boolean));
    results.push({ raw: m[0], names, source: m[5] });
  }
  return results;
}

function joinImportPath(base: string, name: string): string {
  const trimmed = base.replace(/\/+$/, '');
  if (trimmed === '' || trimmed === '.') return `./${name}.astro`;
  return `${trimmed}/${name}.astro`;
}

export function buildUpdatedFrontmatter(
  existingFrontmatter: string | null,
  primitivesUsed: Set<string>,
  iconsUsed: Set<string>,
  primitiveImportBase: string,
  iconImportBase: string,
): string {
  const existing = existingFrontmatter ?? '';
  const existingImports = parseExistingImports(existing);

  const alreadyImported = new Set<string>();
  for (const imp of existingImports) {
    for (const n of imp.names) alreadyImported.add(n);
  }

  const newImportLines: string[] = [];

  const sortedPrimitives = Array.from(primitivesUsed).sort();
  for (const name of sortedPrimitives) {
    if (alreadyImported.has(name)) continue;
    const src = joinImportPath(primitiveImportBase, name);
    newImportLines.push(`import ${name} from '${src}';`);
    alreadyImported.add(name);
  }

  const sortedIcons = Array.from(iconsUsed).sort();
  for (const name of sortedIcons) {
    if (alreadyImported.has(name)) continue;
    const src = joinImportPath(iconImportBase, name);
    newImportLines.push(`import ${name} from '${src}';`);
    alreadyImported.add(name);
  }

  const trimmedExisting = existing.replace(/\s+$/, '');
  const hasMarker = trimmedExisting.includes(REFACTOR_MARKER);

  const parts: string[] = [];
  if (trimmedExisting.length > 0) parts.push(trimmedExisting);
  if (newImportLines.length > 0) parts.push(newImportLines.join('\n'));
  if (!hasMarker) parts.push(REFACTOR_MARKER);

  return parts.join('\n');
}

export function assembleAstroFile(frontmatter: string, body: string): string {
  const fmBlock = `---\n${frontmatter}\n---\n`;
  const trimmedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `${fmBlock}${trimmedBody}`;
}
