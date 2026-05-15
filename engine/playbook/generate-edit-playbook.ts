/**
 * EDIT.md playbook generator.
 *
 * Scans an Astro project (typically the output of rebuild-pro at
 * <clone>/../astro-pro) and writes a per-site EDIT.md describing:
 *   1. Site overview (page / section / image counts)
 *   2. Section files (path, line count, inferred purpose)
 *   3. Image inventory (every <img src> and CSS url() grouped by section)
 *   4. Editable text tokens (>8 chars inside h1-h6, p, a, button)
 *   5. Common edit recipes (static worked examples)
 *
 * Pure file-walker — never imports the Astro toolchain. Safe to run
 * against any directory shaped like a typical Astro project.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

interface ImageRef {
  src: string;
  resolved: string | null;
  origin: 'img' | 'background-image' | 'srcset';
}

interface TextToken {
  text: string;
  tag: string;
  line: number;
}

interface SectionEntry {
  file: string;
  rel: string;
  lines: number;
  purpose: string;
  images: ImageRef[];
  tokens: TextToken[];
}

interface PageEntry {
  rel: string;
  lines: number;
}

export interface PlaybookOutcome {
  path: string;
  bytes: number;
}

function toPosix(p: string): string {
  return p.split(sep).join(posix.sep);
}

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function walk(root: string, predicate: (file: string) => boolean): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of safeReadDir(dir)) {
      if (
        entry === 'node_modules' ||
        entry === 'dist' ||
        entry === '.astro' ||
        entry.startsWith('.')
      ) {
        continue;
      }
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (predicate(full)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function readLines(file: string): string[] {
  return readFileSync(file, 'utf8').split('\n');
}

function inferPurposeFromName(filename: string): string {
  const base = filename.replace(/\.astro$/, '');
  // CamelCase or kebab to spaced words.
  const spaced = base
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function inferPurposeFromHeading(lines: string[]): string | null {
  for (const line of lines) {
    const m = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(line);
    if (m) {
      const text = stripTags(m[1]).trim();
      if (text.length > 0) return text.slice(0, 120);
    }
  }
  return null;
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function resolveImagePath(
  src: string,
  projectRoot: string,
): string | null {
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return null;
  const clean = src.split('?')[0].split('#')[0];
  if (clean.startsWith('/')) {
    const candidate = join(projectRoot, 'public', clean);
    return existsSync(candidate) ? toPosix(relative(projectRoot, candidate)) : `public${clean}`;
  }
  return clean;
}

function extractImages(content: string, projectRoot: string): ImageRef[] {
  const refs: ImageRef[] = [];
  const seen = new Set<string>();

  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(content)) !== null) {
    const src = m[1];
    const key = `img:${src}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ src, resolved: resolveImagePath(src, projectRoot), origin: 'img' });
  }

  const srcsetRe = /\bsrcset=["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(content)) !== null) {
    for (const part of m[1].split(',')) {
      const src = part.trim().split(/\s+/)[0];
      if (!src) continue;
      const key = `srcset:${src}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({ src, resolved: resolveImagePath(src, projectRoot), origin: 'srcset' });
    }
  }

  const bgRe = /background(?:-image)?\s*:\s*[^;}]*url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi;
  while ((m = bgRe.exec(content)) !== null) {
    const src = m[2];
    const key = `bg:${src}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ src, resolved: resolveImagePath(src, projectRoot), origin: 'background-image' });
  }

  return refs;
}

const TOKEN_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'button'];
const MIN_TOKEN_LEN = 9;

function extractTextTokens(lines: string[]): TextToken[] {
  const tokens: TextToken[] = [];
  const seenOnLine = new Set<string>();
  const tagPattern = new RegExp(
    `<(${TOKEN_TAGS.join('|')})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`,
    'gi',
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpExecArray | null;
    tagPattern.lastIndex = 0;
    while ((m = tagPattern.exec(line)) !== null) {
      const tag = m[1].toLowerCase();
      const text = decodeEntities(stripTags(m[2]));
      if (text.length < MIN_TOKEN_LEN) continue;
      const key = `${tag}|${text}|${i + 1}`;
      if (seenOnLine.has(key)) continue;
      seenOnLine.add(key);
      tokens.push({ text, tag, line: i + 1 });
    }
  }
  return tokens;
}

function collectSections(projectRoot: string): SectionEntry[] {
  const sectionsDir = join(projectRoot, 'src', 'components', 'sections');
  if (!existsSync(sectionsDir)) return [];
  const files = walk(sectionsDir, (f) => f.endsWith('.astro'));
  return files.map<SectionEntry>((file) => {
    const lines = readLines(file);
    const content = lines.join('\n');
    const rel = toPosix(relative(projectRoot, file));
    const heading = inferPurposeFromHeading(lines);
    const purpose = heading ?? inferPurposeFromName(file.split(sep).pop()!);
    return {
      file,
      rel,
      lines: lines.length,
      purpose,
      images: extractImages(content, projectRoot),
      tokens: extractTextTokens(lines),
    };
  });
}

function collectPages(projectRoot: string): PageEntry[] {
  const pagesDir = join(projectRoot, 'src', 'pages');
  if (!existsSync(pagesDir)) return [];
  const files = walk(pagesDir, (f) => f.endsWith('.astro'));
  return files.map<PageEntry>((file) => ({
    rel: toPosix(relative(projectRoot, file)),
    lines: readLines(file).length,
  }));
}

function findTokensCss(projectRoot: string): string | null {
  const candidates = [
    join(projectRoot, 'src', 'styles', 'tokens.css'),
    join(projectRoot, 'src', 'styles', 'overrides.css'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return toPosix(relative(projectRoot, c));
  }
  return null;
}

function escapeMd(value: string): string {
  return value
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .replace(/`/g, '\\`');
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
}

function renderOverview(
  projectRoot: string,
  pages: PageEntry[],
  sections: SectionEntry[],
): string {
  const totalImages = sections.reduce((acc, s) => acc + s.images.length, 0);
  const totalTokens = sections.reduce((acc, s) => acc + s.tokens.length, 0);
  const tokensCss = findTokensCss(projectRoot);
  const lines = [
    '## 1. Site overview',
    '',
    `- **Project root:** \`${toPosix(projectRoot)}\``,
    `- **Pages:** ${pages.length}`,
    `- **Sections:** ${sections.length}`,
    `- **Images referenced:** ${totalImages}`,
    `- **Editable text tokens:** ${totalTokens}`,
    `- **Tokens CSS:** ${tokensCss ? `\`${tokensCss}\`` : 'not found'}`,
    '',
  ];
  if (pages.length > 0) {
    lines.push('Pages:', '');
    for (const p of pages) lines.push(`- \`${p.rel}\` (${p.lines} lines)`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderSectionsTable(sections: SectionEntry[]): string {
  if (sections.length === 0) {
    return '## 2. Section files\n\n_No section components found at `src/components/sections/`._\n';
  }
  const rows = [
    '## 2. Section files',
    '',
    '| File | Lines | Purpose |',
    '|------|-------|---------|',
  ];
  for (const s of sections) {
    rows.push(`| \`${s.rel}\` | ${s.lines} | ${escapeMd(truncate(s.purpose, 80))} |`);
  }
  rows.push('');
  return rows.join('\n');
}

function renderImageInventory(sections: SectionEntry[]): string {
  const out: string[] = ['## 3. Image inventory', ''];
  const withImages = sections.filter((s) => s.images.length > 0);
  if (withImages.length === 0) {
    out.push('_No `<img>` or `background-image` references found in sections._', '');
    return out.join('\n');
  }
  for (const s of withImages) {
    out.push(`### \`${s.rel}\``, '');
    out.push('| Origin | src | Resolved |');
    out.push('|--------|-----|----------|');
    for (const img of s.images) {
      out.push(
        `| ${img.origin} | \`${escapeMd(truncate(img.src, 90))}\` | ${
          img.resolved ? `\`${img.resolved}\`` : '_external_'
        } |`,
      );
    }
    out.push('');
  }
  return out.join('\n');
}

function renderTokens(sections: SectionEntry[]): string {
  const out: string[] = [
    '## 4. Editable tokens',
    '',
    'Strings of 9+ characters inside `<h1>`-`<h6>`, `<p>`, `<a>`, `<button>`. Search for the exact text in the linked file to edit.',
    '',
  ];
  const withTokens = sections.filter((s) => s.tokens.length > 0);
  if (withTokens.length === 0) {
    out.push('_No editable tokens detected._', '');
    return out.join('\n');
  }
  for (const s of withTokens) {
    out.push(`### \`${s.rel}\``, '');
    out.push('| Line | Tag | Text |');
    out.push('|------|-----|------|');
    for (const tok of s.tokens) {
      out.push(`| ${tok.line} | \`${tok.tag}\` | ${escapeMd(truncate(tok.text, 140))} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

function renderRecipes(tokensCss: string | null): string {
  const tokensRef = tokensCss ?? 'src/styles/tokens.css';
  return [
    '## 5. Common edit recipes',
    '',
    '### 5.1 Change a heading or paragraph',
    '',
    '1. Find the exact text in section 4 above (Editable tokens).',
    '2. Note the section file and line number.',
    '3. From the project root, run:',
    '   ```bash',
    '   grep -n "your search phrase" src/components/sections/<File>.astro',
    '   ```',
    '4. Edit the file in place. Save. Astro hot-reloads.',
    '',
    '### 5.2 Replace an image',
    '',
    '1. Drop the replacement file into `public/images/` (keep the same dimensions for parity).',
    '2. Find the existing path in section 3 above (Image inventory).',
    '3. Update the `src` attribute, `srcset`, or `background-image: url(...)` to point at the new file.',
    '4. For `srcset` entries, update every size variant so responsive picks the right one.',
    '',
    '### 5.3 Change a brand colour or token',
    '',
    `1. Open \`${tokensRef}\`.`,
    '2. Find the CSS custom property you want to change (search for the colour hex).',
    '3. Update the value. Every section that references the token inherits the change.',
    '4. If a colour was inlined into a section, search for the hex across `src/components/sections/` and replace there too.',
    '',
    '### 5.4 Add a new section',
    '',
    '1. Pick the closest existing section in `src/components/sections/` as a template.',
    '2. Copy it to a new file: `cp src/components/sections/Hero.astro src/components/sections/Promo.astro`.',
    '3. Register it in the page that should render it: open `src/pages/index.astro`, add the import, and place `<Promo />` where you want it in the markup.',
    '4. Edit the new section in isolation. The original is untouched.',
    '',
    '### 5.5 Remove a section',
    '',
    '1. In `src/pages/<page>.astro`, delete the `<Section />` tag and its matching import line.',
    '2. If no other page imports the section file, delete `src/components/sections/<Section>.astro` to keep the tree clean.',
    '3. Run `npm run build` from the project root to confirm nothing else references it.',
    '',
  ].join('\n');
}

function renderHeader(projectRoot: string): string {
  const generatedAt = new Date().toISOString();
  return [
    '# EDIT.md',
    '',
    `_Auto-generated edit playbook for \`${toPosix(projectRoot).split('/').pop()}\`._`,
    '',
    `Generated: ${generatedAt}`,
    '',
    'This document is regenerated by `rebuild-pro` on every run. Use it as a map for editing the site. Sections below list every file, image reference, and editable text token, plus worked recipes for the most common changes.',
    '',
  ].join('\n');
}

export function generateEditPlaybook(projectRoot: string): PlaybookOutcome {
  if (!existsSync(projectRoot)) {
    throw new Error(`Project root not found: ${projectRoot}`);
  }
  const pages = collectPages(projectRoot);
  const sections = collectSections(projectRoot);
  const tokensCss = findTokensCss(projectRoot);

  const body = [
    renderHeader(projectRoot),
    renderOverview(projectRoot, pages, sections),
    renderSectionsTable(sections),
    renderImageInventory(sections),
    renderTokens(sections),
    renderRecipes(tokensCss),
  ].join('\n');

  const outPath = join(projectRoot, 'EDIT.md');
  const content = body.endsWith('\n') ? body : body + '\n';
  writeFileSync(outPath, content, 'utf8');
  return { path: outPath, bytes: Buffer.byteLength(content, 'utf8') };
}
