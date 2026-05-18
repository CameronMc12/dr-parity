/**
 * Catalogue writer.
 *
 * Writes a section's full set of artefacts to disk:
 *   <output>/sites/<siteId>/sections/<sku>/
 *     meta.json
 *     source.tsx
 *     preview.html
 *     prompt.md
 *     thumbnail.png (written separately by renderer)
 *
 * Also writes the per-site `site.json` at <output>/sites/<siteId>/site.json.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CatalogueItem, Site } from "./types";

export interface SectionWriteInput {
  outputRoot: string;
  siteId: string;
  sku: string;
  meta: CatalogueItem;
  source: string;
  previewHtml: string;
  promptMd: string;
}

export function sectionDir(outputRoot: string, siteId: string, sku: string): string {
  return join(outputRoot, "sites", siteId, "sections", sku);
}

export function siteDir(outputRoot: string, siteId: string): string {
  return join(outputRoot, "sites", siteId);
}

async function writeIfChanged(path: string, content: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

export async function writeSection(input: SectionWriteInput): Promise<string> {
  const dir = sectionDir(input.outputRoot, input.siteId, input.sku);
  await mkdir(dir, { recursive: true });

  await writeIfChanged(join(dir, "meta.json"), JSON.stringify(input.meta, null, 2) + "\n");
  await writeIfChanged(join(dir, "source.tsx"), input.source);
  await writeIfChanged(join(dir, "preview.html"), input.previewHtml);
  await writeIfChanged(join(dir, "prompt.md"), input.promptMd);

  return dir;
}

export async function writeSite(outputRoot: string, site: Site): Promise<string> {
  const dir = siteDir(outputRoot, site.id);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "site.json");
  await writeIfChanged(path, JSON.stringify(site, null, 2) + "\n");
  return path;
}

export async function writeThumbnail(
  outputRoot: string,
  siteId: string,
  sku: string,
  png: Buffer,
): Promise<string> {
  const path = join(sectionDir(outputRoot, siteId, sku), "thumbnail.png");
  await writeIfChanged(path, png);
  return path;
}
