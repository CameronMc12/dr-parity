/**
 * Extract a multi-page Vite + React build into catalogue entries.
 *
 * Validates the source layout, walks each page's component folder, and
 * returns a fully formed `ExtractionPlan` that the CLI driver then writes
 * to disk and screenshots via Playwright.
 */

import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { CatalogueItem, ProjectType, Site } from "./types";
import { buildSku, humaniseComponentName, kebab } from "./sku";

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
}

export interface ExtractionPlan {
  site: Site;
  sections: PlannedSection[];
  pagesByEntry: Record<string, { slug: string; title: string; entry: string }>;
}

const PAGE_TITLE_FALLBACKS: Record<string, string> = {
  index: "Home",
};

export async function validateReactBuild(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    throw new Error(`react-build path does not exist: ${dir}`);
  }
  const required = [
    "src/pages",
    "src/components",
    "package.json",
  ];
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
  // Common patterns: "About Us - Vivre Agency", "Vivre Agency - Digital Marketing Agency".
  // For the home page, prefer the human-readable fallback. For others, strip
  // a trailing " - <siteName>" or " | <siteName>" suffix.
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
  return all
    .filter((f) => f.endsWith(".html"))
    .sort();
}

async function listComponentDirs(componentsRoot: string): Promise<string[]> {
  const entries = await readdir(componentsRoot, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function listTsxFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((f) => f.endsWith(".tsx")).sort();
}

function deriveTags(source: string): string[] {
  const tags = new Set<string>();
  if (/<video\b/i.test(source)) tags.add("video");
  if (/<form\b/i.test(source)) tags.add("form");
  if (/<img\b/i.test(source)) tags.add("image");
  if (/swiper|carousel|slider/i.test(source)) tags.add("carousel");
  if (/hero[-_ ]?section|hero-heading|hero-content/i.test(source)) tags.add("hero");
  if (/<footer\b/i.test(source)) tags.add("footer");
  if (/<header\b/i.test(source)) tags.add("header");
  if (/<nav\b/i.test(source)) tags.add("nav");
  return Array.from(tags).sort();
}

function deriveDescription(name: string, siteName: string, pageSlug: string): string {
  return `${name} section captured from ${siteName} (${pageSlug} page).`;
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

  const sections: PlannedSection[] = [];
  for (const folder of componentFolders) {
    const isShared = folder === "shared";
    if (isShared && !opts.includeShared) continue;

    const folderPath = join(componentsRoot, folder);
    const tsxFiles = await listTsxFiles(folderPath);

    for (const file of tsxFiles) {
      const sourcePath = join(folderPath, file);
      const sourceStat = await stat(sourcePath);
      if (!sourceStat.isFile()) continue;

      const source = await readFile(sourcePath, "utf8");
      const componentName = humaniseComponentName(file);
      const componentSlug = kebab(file.replace(/\.tsx?$/, ""));
      const pageForSku = isShared ? "shared" : folder;

      const sku = buildSku({
        siteId: opts.siteId,
        page: pageForSku,
        componentSlug,
        source,
      });

      const tags = deriveTags(source);
      const description = deriveDescription(componentName, opts.siteName, pageForSku);

      // Map the section's parent page slug to its HTML entry inside dist/.
      // Shared sections default to the home page (index.html) as the safest
      // place to preview them. The dashboard reads parentPagePath to iframe
      // the real page from the bundled React build.
      const parentSlug = isShared ? "index" : folder;
      const parentPagePath = pagesByEntry[parentSlug]
        ? pagesByEntry[parentSlug].entry
        : `${parentSlug}.html`;

      const meta: CatalogueItem = {
        sku,
        taxonomy: "section",
        name: componentName,
        slug: componentSlug,
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

      sections.push({
        sku,
        page: pageForSku,
        componentFile: file,
        componentName,
        componentSlug,
        sourcePath,
        source,
        meta,
        isShared,
      });
    }
  }

  // Deduplicate by SKU. If two shared components hash to the same SKU as
  // their per-page copies, keep the first one (shared sits at the end after
  // sort because 'shared' > letter pages alphabetically in many cases, so
  // we sort by isShared=false first).
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
