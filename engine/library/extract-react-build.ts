/**
 * Extract a multi-page Vite + React build into catalogue entries.
 *
 * Validates the source layout, walks each page's component folder, and
 * returns a fully formed `ExtractionPlan` that the CLI driver then writes
 * to disk and screenshots via Playwright.
 *
 * Responsibilities specific to this revision:
 *   - BodyPreamble.tsx is excluded entirely (slicer scaffolding).
 *   - MainBody.tsx is split into top-level JSX sub-sections via
 *     split-mainbody.ts. Each sub-section gets its own SKU + meta.
 *   - All section names are derived semantically from JSX content
 *     (see derive-name.ts and naming-rules.md).
 */

import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { CatalogueItem, ProjectType, Site } from "./types";
import { buildSku, kebab } from "./sku";
import { deriveName, deriveTags, disambiguateNames, type SectionRole } from "./derive-name";
import { splitMainBody, type SplitChild } from "./split-mainbody";

export interface ExtractOptions {
  reactBuildDir: string;
  siteId: string;
  siteName: string;
  domain: string;
  projectTypes: ProjectType[];
  includeShared: boolean;
  capturedAt: string;
}

export interface PlannedSection {
  sku: string;
  page: string;
  componentFile: string;
  componentName: string;
  componentSlug: string;
  sourcePath: string;
  source: string;
  meta: CatalogueItem;
  isShared: boolean;
  /** Role used for naming + bbox capture */
  role: SectionRole;
  /**
   * For sub-sections split from MainBody, the zero-based index among the
   * meaningful top-level children of the wrapper. -1 for non-main sections.
   */
  mainChildIndex: number;
  /** Optional first heading text extracted from the source. Aids bbox fallback. */
  headingText: string | null;
}

export interface ExtractionPlan {
  site: Site;
  sections: PlannedSection[];
  pagesByEntry: Record<string, { slug: string; title: string; entry: string }>;
}

const PAGE_TITLE_FALLBACKS: Record<string, string> = {
  index: "Home",
};

const MIN_COMPONENT_CHARS = 200;

export async function validateReactBuild(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    throw new Error(`react-build path does not exist: ${dir}`);
  }
  const required = ["src/pages", "src/components", "package.json"];
  for (const rel of required) {
    if (!existsSync(join(dir, rel))) {
      throw new Error(`react-build is missing required path: ${rel}`);
    }
  }

  const entries = await readdir(dir);
  const htmlEntries = entries.filter((f) => f.endsWith(".html"));
  if (htmlEntries.length < 2) {
    throw new Error(
      `react-build expected to be multi-page. Found only ${htmlEntries.length} html entries.`,
    );
  }
}

async function parseTitle(htmlPath: string): Promise<string | null> {
  const html = await readFile(htmlPath, "utf8");
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function cleanPageTitle(raw: string | null, siteName: string, slug: string): string | null {
  if (!raw) return null;
  if (slug === "index") return PAGE_TITLE_FALLBACKS[slug] ?? raw;
  const patterns = [
    new RegExp(`\\s*[-\\u2013\\u2014|]\\s*${escapeForRegex(siteName)}\\s*$`, "i"),
  ];
  let out = raw;
  for (const p of patterns) {
    out = out.replace(p, "");
  }
  return out.trim().length > 0 ? out.trim() : raw;
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listHtmlEntries(dir: string): Promise<string[]> {
  const all = await readdir(dir);
  return all.filter((f) => f.endsWith(".html")).sort();
}

async function listComponentDirs(componentsRoot: string): Promise<string[]> {
  const entries = await readdir(componentsRoot, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

async function listTsxFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((f) => f.endsWith(".tsx")).sort();
}

function deriveDescription(name: string, siteName: string, pageSlug: string): string {
  return `${name} captured from ${siteName} (${pageSlug} page).`;
}

function placeholderPreviewHtml(name: string, sku: string, pageSlug: string): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    `    <title>Preview: ${name}</title>`,
    "    <style>",
    "      body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 2rem; color: #1f2937; }",
    "      code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 0.25rem; }",
    "      .meta { color: #6b7280; font-size: 0.875rem; }",
    "    </style>",
    "  </head>",
    "  <body>",
    `    <h1>${name}</h1>`,
    `    <p class="meta">SKU: <code>${sku}</code></p>`,
    `    <p class="meta">Source page: <code>${pageSlug}</code></p>`,
    "    <p>Preview pending. See <code>source.tsx</code> for the component code, or open the parent page in the catalogue UI.</p>",
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

function classifyFile(file: string): "header" | "footer" | "mainbody" | "bodypreamble" | "other" {
  const base = file.replace(/\.tsx?$/, "").toLowerCase();
  if (base === "header") return "header";
  if (base === "footer") return "footer";
  if (base === "mainbody") return "mainbody";
  if (base === "bodypreamble") return "bodypreamble";
  return "other";
}

function extractFirstHeadingText(source: string): string | null {
  const m = source.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
  if (!m) return null;
  const cleaned = m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

interface PlannedDraft {
  role: SectionRole;
  isShared: boolean;
  pageSlug: string;
  componentFile: string;
  sourcePath: string;
  source: string;
  derivedName: string;
  componentSlug: string;
  mainChildIndex: number;
  headingText: string | null;
}

function makeSection(
  draft: PlannedDraft,
  finalName: string,
  opts: ExtractOptions,
  pagesByEntry: Record<string, { slug: string; title: string; entry: string }>,
): PlannedSection {
  const pageForSku = draft.isShared ? "shared" : draft.pageSlug;
  const sku = buildSku({
    siteId: opts.siteId,
    page: pageForSku,
    componentSlug: draft.componentSlug,
    source: draft.source,
  });

  const tags = deriveTags(draft.source, draft.role);
  const description = deriveDescription(finalName, opts.siteName, pageForSku);
  const parentSlug = draft.isShared ? "index" : draft.pageSlug;
  const parentPagePath = pagesByEntry[parentSlug]
    ? pagesByEntry[parentSlug].entry
    : `${parentSlug}.html`;

  const meta: CatalogueItem = {
    sku,
    taxonomy: "section",
    name: finalName,
    slug: draft.componentSlug,
    site: opts.siteId,
    page: pageForSku,
    projectType: opts.projectTypes,
    tags,
    description,
    thumbnail: "thumbnail.png",
    previewUrl: parentPagePath,
    parentPagePath,
    sourcePath: "source.tsx",
    promptPath: "prompt.md",
    dependencies: ["react@^18", "react-dom@^18"],
    cssDeps: [],
    createdAt: opts.capturedAt,
    updatedAt: opts.capturedAt,
  };

  return {
    sku,
    page: pageForSku,
    componentFile: draft.componentFile,
    componentName: finalName,
    componentSlug: draft.componentSlug,
    sourcePath: draft.sourcePath,
    source: draft.source,
    meta,
    isShared: draft.isShared,
    role: draft.role,
    mainChildIndex: draft.mainChildIndex,
    headingText: draft.headingText,
  };
}

function buildMainSubSectionDrafts(
  pageSlug: string,
  isShared: boolean,
  filePath: string,
  fileName: string,
  fullSource: string,
  children: SplitChild[],
): PlannedDraft[] {
  return children.map((child, idx) => {
    const heading = extractFirstHeadingText(child.source);
    const derivedName = deriveName(child.source, "main");
    const slugBase = kebab(derivedName) || `section-${idx + 1}`;
    return {
      role: "main",
      isShared,
      pageSlug,
      componentFile: fileName,
      sourcePath: filePath,
      source: child.source,
      derivedName,
      componentSlug: `${slugBase}-${idx + 1}`,
      mainChildIndex: idx,
      headingText: heading,
    };
  });
}

export async function planExtraction(opts: ExtractOptions): Promise<ExtractionPlan> {
  await validateReactBuild(opts.reactBuildDir);

  const htmlEntries = await listHtmlEntries(opts.reactBuildDir);
  const pagesByEntry: Record<string, { slug: string; title: string; entry: string }> = {};
  for (const entry of htmlEntries) {
    const slug = basename(entry, ".html");
    const rawTitle = await parseTitle(join(opts.reactBuildDir, entry));
    const fallback = PAGE_TITLE_FALLBACKS[slug] ?? slug.replace(/-/g, " ");
    const cleaned = cleanPageTitle(rawTitle, opts.siteName, slug);
    const title = cleaned ?? fallback;
    pagesByEntry[slug] = { slug, title, entry };
  }

  const componentsRoot = join(opts.reactBuildDir, "src", "components");
  const componentFolders = await listComponentDirs(componentsRoot);

  // Collect drafts first so we can disambiguate names per page before
  // finalising SKUs and metadata.
  const draftsByPage = new Map<string, PlannedDraft[]>();
  const warnings: string[] = [];

  for (const folder of componentFolders) {
    const isShared = folder === "shared";
    if (isShared && !opts.includeShared) continue;

    const folderPath = join(componentsRoot, folder);
    const tsxFiles = await listTsxFiles(folderPath);
    const pageSlug = isShared ? "shared" : folder;
    const drafts: PlannedDraft[] = [];

    for (const file of tsxFiles) {
      const sourcePath = join(folderPath, file);
      const sourceStat = await stat(sourcePath);
      if (!sourceStat.isFile()) continue;

      const source = await readFile(sourcePath, "utf8");
      if (source.length < MIN_COMPONENT_CHARS) continue;

      const kind = classifyFile(file);
      if (kind === "bodypreamble") continue; // excluded

      if (kind === "header" || kind === "footer") {
        const role: SectionRole = kind;
        const finalName = role === "header" ? "Header" : "Footer";
        drafts.push({
          role,
          isShared,
          pageSlug,
          componentFile: file,
          sourcePath,
          source,
          derivedName: finalName,
          componentSlug: role,
          mainChildIndex: -1,
          headingText: extractFirstHeadingText(source),
        });
        continue;
      }

      if (kind === "mainbody") {
        const split = splitMainBody(source);
        if (split && split.children.length > 0) {
          drafts.push(
            ...buildMainSubSectionDrafts(pageSlug, isShared, sourcePath, file, source, split.children),
          );
        } else {
          warnings.push(
            `split-mainbody fallback for ${folder}/${file} (${split?.reason ?? "parse-failed"}); emitting as single section`,
          );
          drafts.push({
            role: "main",
            isShared,
            pageSlug,
            componentFile: file,
            sourcePath,
            source,
            derivedName: "Main Content",
            componentSlug: "main-content",
            mainChildIndex: 0,
            headingText: extractFirstHeadingText(source),
          });
        }
        continue;
      }

      // Other component file types (rare). Treat as a normal section but
      // derive name from content rather than filename.
      const role: SectionRole = isShared ? "shared" : "main";
      const derivedName = deriveName(source, role);
      drafts.push({
        role,
        isShared,
        pageSlug,
        componentFile: file,
        sourcePath,
        source,
        derivedName,
        componentSlug: kebab(file.replace(/\.tsx?$/, "")),
        mainChildIndex: -1,
        headingText: extractFirstHeadingText(source),
      });
    }

    draftsByPage.set(pageSlug, drafts);
  }

  if (warnings.length > 0) {
    for (const w of warnings) console.warn(`plan-extraction: ${w}`);
  }

  // Disambiguate names within each page.
  const sections: PlannedSection[] = [];
  for (const [, drafts] of draftsByPage) {
    const names = drafts.map((d) => d.derivedName);
    const disambiguated = disambiguateNames(names);
    drafts.forEach((d, i) => {
      const finalName = disambiguated[i];
      sections.push(makeSection(d, finalName, opts, pagesByEntry));
    });
  }

  // Deduplicate by SKU (shared component identical to per-page copy).
  sections.sort((a, b) => {
    if (a.isShared !== b.isShared) return a.isShared ? 1 : -1;
    return a.sku.localeCompare(b.sku);
  });
  const seen = new Set<string>();
  const deduped = sections.filter((s) => {
    if (seen.has(s.sku)) return false;
    seen.add(s.sku);
    return true;
  });

  const site: Site = {
    id: opts.siteId,
    name: opts.siteName,
    domain: opts.domain,
    projectType: opts.projectTypes,
    pages: Object.values(pagesByEntry).map(({ slug, title }) => ({ slug, title })),
    sections: deduped.map((s) => s.sku),
    capturedAt: opts.capturedAt,
    thumbnail: "thumbnail.png",
  };

  return { site, sections: deduped, pagesByEntry };
}

export { placeholderPreviewHtml };
