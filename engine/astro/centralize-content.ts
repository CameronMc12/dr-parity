/**
 * Centralised editable content extraction.
 *
 * Scans section components, pulls static text strings out of <h1-h6>, <p>,
 * <a>, <button> (length > 8 chars), writes them to `src/content/site.ts` as a
 * typed `siteContent` export, and rewrites the original components to
 * reference the central store.
 *
 * ---------------------------------------------------------------------------
 * FIX #8 INVESTIGATION (2026-05-15): why Phase 12 produced 0 extractions on
 * real Section.astro files.
 *
 * Symptom: Phase 12 reported `sectionsScanned=0, fieldsExtracted=0` against
 * clones that clearly had inline text in their section components.
 *
 * Original hypothesis: "Sections use prop-driven rendering, text passed in
 * from index.astro as data — so there is nothing inline to extract."
 *
 * Actual root cause: PATH MISMATCH, not prop-driven rendering. This function
 * only scanned `src/components/sections/`, but neither the single-page emitter
 * (build.ts → writeComponent) nor the multi-page emitter (build-multi.ts →
 * emitMultiPage) writes to that folder. Real clones lay out sections at:
 *   - `src/components/<pageName>/Section*.astro`   (multi-page, per-page)
 *   - `src/components/shared/<Name>.astro`         (multi-page, shared)
 *   - `src/components/Section*.astro`              (single-page, flat)
 * None of these match the hard-coded `src/components/sections/` scan root, so
 * the directory check fails fast and the function exits with zero results.
 *
 * Evidence: inspecting Section02_HomeVideo.astro and Section09_Replicar... in
 * the enerblock-net-en clone shows fully inline `<h2>` and `<p>` text. The
 * data IS extractable; the scanner was looking in the wrong place.
 *
 * Fix: walk every `.astro` file under `src/components/` recursively (excluding
 * `primitives/` and `icons/`, which are reusable building blocks rather than
 * page-specific sections). Section key still derives from the file basename;
 * collisions across folders are disambiguated by prefixing the parent folder.
 * ---------------------------------------------------------------------------
 *
 * Design choices:
 * - Section name (file basename without extension, optionally prefixed with
 *   its containing folder) is the top-level key.
 * - Within a section, fields are grouped by tag type and sequence number
 *   (`heading1`, `paragraph1`, `link1`, ...). Predictable, no name collisions.
 * - The original text is preserved verbatim in `siteContent`. Markup inside
 *   the extracted tag (e.g. `<a>` inside `<p>`) is NOT flattened — those
 *   nodes are left in place and only top-level text-only tags are extracted.
 * - Idempotent: running the script twice on the same dir is a no-op.
 *
 * The script is intentionally conservative. If a tag contains nested elements
 * (anything other than text + whitespace), it is skipped — we cannot safely
 * round-trip rich markup through a string export.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import * as cheerio from 'cheerio';

const EXTRACTABLE_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'button'] as const;
const MIN_TEXT_LENGTH = 9; // > 8 chars per spec
const MARKER = '/* @generated-by-centralizeContent */';

export interface CentralizeSummary {
  sectionsScanned: number;
  fieldsExtracted: number;
  filesRewritten: number;
  contentFile: string | null;
}

interface ExtractedField {
  sectionKey: string;
  fieldKey: string;
  value: string;
}

export async function centralizeContent(outDir: string): Promise<CentralizeSummary> {
  const componentsDir = join(outDir, 'src', 'components');
  const contentDir = join(outDir, 'src', 'content');
  const contentFile = join(contentDir, 'site.ts');

  const summary: CentralizeSummary = {
    sectionsScanned: 0,
    fieldsExtracted: 0,
    filesRewritten: 0,
    contentFile: null,
  };

  if (!existsSync(componentsDir)) return summary;

  const sectionFiles = collectSectionFiles(componentsDir);

  // Parse + collect first, so we can emit site.ts before rewriting any source.
  type ParsedSection = {
    file: string;
    sectionKey: string;
    source: string;
    extractions: ExtractedField[];
    // For each extraction, the unique placeholder marker that will replace
    // the original text node during the rewrite step.
    placeholders: Map<string, string>;
  };
  const parsed: ParsedSection[] = [];
  const usedKeys = new Set<string>();

  for (const file of sectionFiles) {
    summary.sectionsScanned += 1;
    const source = readFileSync(file, 'utf8');
    if (source.includes(MARKER)) continue; // idempotent
    const sectionKey = uniqueSectionKey(file, componentsDir, usedKeys);
    const { extractions, placeholders } = extractSection(sectionKey, source);
    parsed.push({ file, sectionKey, source, extractions, placeholders });
    summary.fieldsExtracted += extractions.length;
  }

  if (summary.fieldsExtracted === 0) return summary;

  // 1. Emit site.ts
  mkdirSync(contentDir, { recursive: true });
  const allFields = parsed.flatMap((p) => p.extractions);
  writeFileSync(contentFile, renderSiteTs(allFields), 'utf8');
  summary.contentFile = contentFile;

  // 2. Rewrite each section
  for (const p of parsed) {
    if (p.extractions.length === 0) continue;
    const importPath = relativeImportPath(p.file, contentFile);
    const rewritten = rewriteSection(
      p.source,
      p.sectionKey,
      p.placeholders,
      p.extractions,
      importPath,
    );
    writeFileSync(p.file, rewritten, 'utf8');
    summary.filesRewritten += 1;
  }

  return summary;
}

/**
 * Build the POSIX-style relative import specifier from a section file to the
 * generated `src/content/site.ts`. Strips the `.ts` extension and ensures
 * the result starts with `./` or `../`.
 */
function relativeImportPath(fromFile: string, toFile: string): string {
  const rel = relative(dirname(fromFile), toFile).split(sep).join('/');
  const withoutExt = rel.replace(/\.ts$/, '');
  return withoutExt.startsWith('.') ? withoutExt : `./${withoutExt}`;
}

function basenameNoExt(file: string): string {
  return basename(file).replace(/\.astro$/, '');
}

function camelCase(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^([A-Z])/, (m) => m.toLowerCase());
}

/**
 * Folders that hold reusable building blocks rather than page-specific
 * sections. We skip them so the site.ts store stays focused on editable
 * marketing copy (headings, paragraphs, links inside hero/feature/CTA
 * sections) and does not pull in primitive button labels or icon titles.
 */
const COMPONENT_SKIP_FOLDERS = new Set(['primitives', 'icons', 'seo']);

/**
 * Recursively collect every `.astro` file under `src/components/`, skipping
 * the reusable-primitive folders. Order is sorted so the output is stable
 * across runs.
 */
function collectSectionFiles(componentsDir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [componentsDir];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (COMPONENT_SKIP_FOLDERS.has(entry)) continue;
        stack.push(full);
      } else if (entry.endsWith('.astro')) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

/**
 * Build a unique camelCase section key for a file. Same-named files in
 * different folders (e.g. `index/Hero.astro` and `about/Hero.astro`) get
 * disambiguated by prefixing the immediate parent folder.
 */
function uniqueSectionKey(file: string, baseDir: string, used: Set<string>): string {
  const baseKey = camelCase(basenameNoExt(file));
  if (!used.has(baseKey)) {
    used.add(baseKey);
    return baseKey;
  }
  const rel = relative(baseDir, dirname(file));
  const parent = rel.split(sep).filter(Boolean).pop() ?? '';
  const prefixed = parent ? camelCase(`${parent}-${basenameNoExt(file)}`) : baseKey;
  let candidate = prefixed;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${prefixed}${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Walk the body of a `.astro` file and extract text-only contents of every
 * matching tag. Returns the extracted fields plus a placeholder map keyed by
 * a unique string the rewriter can find later.
 */
function extractSection(
  sectionKey: string,
  source: string,
): { extractions: ExtractedField[]; placeholders: Map<string, string> } {
  const { body } = splitFrontmatter(source);
  // We strip <style> and <script> blocks before HTML parsing — their inner
  // text must never be touched.
  const $ = cheerio.load(body, { xml: false }, false);

  const extractions: ExtractedField[] = [];
  const placeholders = new Map<string, string>();
  const counters = new Map<string, number>();

  $(EXTRACTABLE_TAGS.join(',')).each((_, el) => {
    const $el = $(el);
    // Skip anything inside <style>, <script>, or already-replaced tags
    if ($el.parents('style, script').length > 0) return;
    // Tag must contain text-only content (no nested elements). This protects
    // against accidentally flattening complex markup.
    const children = ($el[0] as unknown as { children?: { type: string }[] }).children ?? [];
    const hasElementChild = children.some((c) => c.type === 'tag');
    if (hasElementChild) return;

    const raw = $el.text();
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (trimmed.length < MIN_TEXT_LENGTH) return;

    const tagName = (el as unknown as { name: string }).name.toLowerCase();
    const fieldType = tagToField(tagName);
    const idx = (counters.get(fieldType) ?? 0) + 1;
    counters.set(fieldType, idx);
    const fieldKey = idx === 1 ? fieldType : `${fieldType}${idx}`;

    extractions.push({ sectionKey, fieldKey, value: trimmed });
    // Build a placeholder unique enough to find in source via string match.
    const placeholder = `__CENTRALIZE_PH_${sectionKey}_${fieldKey}__`;
    placeholders.set(placeholder, trimmed);
  });

  return { extractions, placeholders };
}

function tagToField(tag: string): string {
  if (/^h[1-6]$/.test(tag)) return `heading${tag[1]}`;
  if (tag === 'p') return 'paragraph';
  if (tag === 'a') return 'link';
  if (tag === 'button') return 'button';
  return tag;
}

function splitFrontmatter(astro: string): { frontmatter: string; body: string } {
  if (!astro.startsWith('---')) return { frontmatter: '', body: astro };
  const close = astro.indexOf('\n---', 3);
  if (close === -1) return { frontmatter: '', body: astro };
  const fenceEnd = close + '\n---'.length;
  return { frontmatter: astro.slice(0, fenceEnd), body: astro.slice(fenceEnd) };
}

function renderSiteTs(fields: ExtractedField[]): string {
  // Group by section
  const bySection = new Map<string, ExtractedField[]>();
  for (const f of fields) {
    const arr = bySection.get(f.sectionKey) ?? [];
    arr.push(f);
    bySection.set(f.sectionKey, arr);
  }

  const sectionTypeLines: string[] = [];
  const sectionDataLines: string[] = [];
  for (const [sectionKey, items] of [...bySection.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    sectionTypeLines.push(`  ${sectionKey}: {`);
    sectionDataLines.push(`  ${sectionKey}: {`);
    for (const f of items) {
      sectionTypeLines.push(`    ${f.fieldKey}: string;`);
      sectionDataLines.push(`    ${f.fieldKey}: ${jsString(f.value)},`);
    }
    sectionTypeLines.push(`  };`);
    sectionDataLines.push(`  },`);
  }

  return [
    MARKER,
    '/**',
    ' * Central site content store.',
    ' *',
    ' * Auto-generated by centralizeContent(). Edit the values below to update',
    ' * the visible copy across every section component. To re-extract from',
    ' * source after structural edits, run the rebuild-pro pipeline.',
    ' */',
    '',
    'export interface SiteContent {',
    ...sectionTypeLines,
    '}',
    '',
    'export const siteContent: SiteContent = {',
    ...sectionDataLines,
    '};',
    '',
  ].join('\n');
}

function jsString(s: string): string {
  // Prefer double-quoted JS strings; escape backslashes, double-quotes,
  // and control chars.
  return (
    '"' +
    s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') +
    '"'
  );
}

/**
 * Rewrite a single section file: replace the extracted text content with
 * `{siteContent.<section>.<field>}` references and add the import at the top.
 */
function rewriteSection(
  source: string,
  sectionKey: string,
  placeholders: Map<string, string>,
  extractions: ExtractedField[],
  importPath: string,
): string {
  // Build a {value -> field} lookup. We replace text content via a
  // first-match strategy that walks the cheerio AST in document order so
  // that two identical strings in the same section map to the correct
  // sequential fields.
  const fieldQueue = new Map<string, string[]>();
  for (const f of extractions) {
    const arr = fieldQueue.get(f.value) ?? [];
    arr.push(f.fieldKey);
    fieldQueue.set(f.value, arr);
  }

  const { frontmatter, body } = splitFrontmatter(source);
  const $ = cheerio.load(body, { xml: false }, false);

  $(EXTRACTABLE_TAGS.join(',')).each((_, el) => {
    const $el = $(el);
    if ($el.parents('style, script').length > 0) return;
    const children = ($el[0] as unknown as { children?: { type: string }[] }).children ?? [];
    const hasElementChild = children.some((c) => c.type === 'tag');
    if (hasElementChild) return;

    const raw = $el.text();
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (trimmed.length < MIN_TEXT_LENGTH) return;
    const queue = fieldQueue.get(trimmed);
    if (!queue || queue.length === 0) return;
    const fieldKey = queue.shift() as string;
    // Replace the inner text with a placeholder we resolve via string ops
    // after serialisation — cheerio will html-encode `{}` otherwise.
    const placeholder = `__CENTRALIZE_PH_${sectionKey}_${fieldKey}__`;
    $el.text(placeholder);
  });
  // Suppress unused-var warning while keeping the param signature explicit.
  void placeholders;

  let newBody = $.html();
  // cheerio html-encodes our placeholder if it contained characters it cares
  // about — our placeholder is plain ASCII so it survives, but we still
  // safely substitute via global replace.
  for (const f of extractions) {
    const placeholder = `__CENTRALIZE_PH_${sectionKey}_${f.fieldKey}__`;
    const ref = `{siteContent.${sectionKey}.${f.fieldKey}}`;
    newBody = newBody.split(placeholder).join(ref);
  }

  const newFrontmatter = injectImport(frontmatter, importPath);
  return newFrontmatter + '\n' + newBody;
}

/**
 * Insert the `siteContent` import into the file's frontmatter. If no
 * frontmatter exists yet, create one. Idempotent.
 */
function injectImport(frontmatter: string, importPath: string): string {
  const importLine = `import { siteContent } from "${importPath}";`;
  if (frontmatter.length === 0) {
    return ['---', MARKER, importLine, '---'].join('\n');
  }
  if (frontmatter.includes(importLine)) {
    // Add marker if missing so future runs are idempotent.
    if (!frontmatter.includes(MARKER)) {
      return frontmatter.replace(/^---/, `---\n${MARKER}`);
    }
    return frontmatter;
  }
  // Insert the import after the opening fence.
  return frontmatter.replace(/^---/, `---\n${MARKER}\n${importLine}`);
}

// Suppress unused-import warning for `resolve` (kept for future debugging
// hooks); `relative`, `statSync`, `sep`, `basename` are now actively used.
void resolve;
