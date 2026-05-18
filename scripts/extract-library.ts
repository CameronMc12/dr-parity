#!/usr/bin/env tsx
/**
 * extract-library CLI driver.
 *
 * Walks a multi-page Vite + React build, emits a catalogue under
 * <output>/sites/<site-id>/ with one folder per section.
 *
 * See engine/library/* for the implementation modules.
 */

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  planExtraction,
  placeholderPreviewHtml,
} from "../engine/library/extract-react-build";
import { renderSectionThumbnails } from "../engine/library/render-section-preview";
import { generatePromptMarkdown } from "../engine/library/generate-prompt";
import {
  sectionDir,
  writeSection,
  writeSite,
  writeThumbnail,
} from "../engine/library/write-catalogue";
import { isProjectType, type ProjectType } from "../engine/library/types";

interface CliArgs {
  reactBuild: string;
  siteId: string;
  siteName: string;
  domain: string;
  projectTypes: ProjectType[];
  output: string;
  includeShared: boolean;
  force: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: Partial<CliArgs> & { projectTypes: ProjectType[] } = {
    projectTypes: [],
    includeShared: true,
    force: false,
  };

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    const key = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
    const value = eq === -1 ? "true" : raw.slice(eq + 1);

    switch (key) {
      case "react-build":
        out.reactBuild = value;
        break;
      case "site-id":
        out.siteId = value;
        break;
      case "site-name":
        out.siteName = value;
        break;
      case "domain":
        out.domain = value;
        break;
      case "project-type":
        if (!isProjectType(value)) {
          fail(`Invalid --project-type=${value}. Must be one of the ProjectType enum values.`);
        }
        out.projectTypes.push(value);
        break;
      case "output":
        out.output = value;
        break;
      case "include-shared":
        out.includeShared = value !== "false";
        break;
      case "no-include-shared":
        out.includeShared = false;
        break;
      case "force":
        out.force = value !== "false";
        break;
      default:
        fail(`Unknown flag: --${key}`);
    }
  }

  const missing: string[] = [];
  if (!out.reactBuild) missing.push("--react-build");
  if (!out.siteId) missing.push("--site-id");
  if (!out.siteName) missing.push("--site-name");
  if (!out.domain) missing.push("--domain");
  if (!out.output) missing.push("--output");
  if (out.projectTypes.length === 0) missing.push("--project-type");
  if (missing.length > 0) {
    fail(`Missing required flag(s): ${missing.join(", ")}`);
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(out.siteId!)) {
    fail(`--site-id must be kebab-case (got: ${out.siteId})`);
  }

  return {
    reactBuild: resolve(out.reactBuild!),
    siteId: out.siteId!,
    siteName: out.siteName!,
    domain: out.domain!,
    projectTypes: out.projectTypes,
    output: resolve(out.output!),
    includeShared: out.includeShared ?? true,
    force: out.force ?? false,
  };
}

function fail(msg: string): never {
  console.error(`extract-library error: ${msg}`);
  process.exit(1);
}

function pickBuildDir(reactBuildRoot: string): string {
  const dist = `${reactBuildRoot}/dist`;
  if (existsSync(dist)) return dist;
  return reactBuildRoot;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const capturedAt = new Date().toISOString();

  console.log(`extract-library starting`);
  console.log(`  react-build: ${args.reactBuild}`);
  console.log(`  site-id:     ${args.siteId}`);
  console.log(`  output:      ${args.output}`);
  console.log(`  project-type:${args.projectTypes.join(", ")}`);
  console.log(`  shared:      ${args.includeShared}`);

  const siteRoot = `${args.output}/sites/${args.siteId}`;
  if (existsSync(siteRoot) && args.force) {
    console.log(`  force: clearing existing ${siteRoot}`);
    rmSync(siteRoot, { recursive: true, force: true });
  } else if (existsSync(siteRoot)) {
    console.log(`  note: ${siteRoot} exists. Will overwrite section files in place. Use --force to wipe first.`);
  }

  const plan = await planExtraction({
    reactBuildDir: args.reactBuild,
    siteId: args.siteId,
    siteName: args.siteName,
    domain: args.domain,
    projectTypes: args.projectTypes,
    includeShared: args.includeShared,
    capturedAt,
  });

  console.log(`  plan: ${plan.sections.length} sections across ${plan.site.pages.length} pages`);

  // Write the per-section artefacts (meta + source + preview + prompt).
  let promptsGenerated = 0;
  let previewsGenerated = 0;
  for (const section of plan.sections) {
    const promptMd = generatePromptMarkdown({
      name: section.componentName,
      siteName: args.siteName,
      domain: args.domain,
      pageSlug: section.page,
      capturedAt,
      projectTypes: args.projectTypes,
      source: section.source,
      dependencies: section.meta.dependencies ?? [],
      cssDeps: section.meta.cssDeps ?? [],
    });
    const previewHtml = placeholderPreviewHtml(
      section.componentName,
      section.sku,
      section.page,
    );

    await writeSection({
      outputRoot: args.output,
      siteId: args.siteId,
      sku: section.sku,
      meta: section.meta,
      source: section.source,
      previewHtml,
      promptMd,
    });
    promptsGenerated += 1;
    previewsGenerated += 1;
  }

  // Render thumbnails via Playwright against the build dist.
  const buildDir = pickBuildDir(args.reactBuild);
  console.log(`  thumbnails: serving from ${buildDir}`);

  let thumbnailsGenerated = 0;
  const failures: string[] = [];
  try {
    const results = await renderSectionThumbnails({
      buildDir,
      port: 47213,
      pagesByEntry: plan.pagesByEntry,
      sections: plan.sections,
      thumbnailWidth: 800,
      thumbnailHeight: 500,
      onProgress: (m) => console.log(`    ${m}`),
    });
    for (const r of results) {
      if (r.png && r.png.length > 0) {
        await writeThumbnail(args.output, args.siteId, r.sku, r.png);
        thumbnailsGenerated += 1;
      } else {
        failures.push(`${r.sku} (${r.reason ?? "unknown"})`);
      }
    }
  } catch (err) {
    console.warn(`thumbnail rendering failed: ${(err as Error).message}`);
    failures.push(`renderer-crashed: ${(err as Error).message}`);
  }

  await writeSite(args.output, plan.site);

  console.log(`\nextract-library done`);
  console.log(`  sites:      1`);
  console.log(`  sections:   ${plan.sections.length}`);
  console.log(`  thumbnails: ${thumbnailsGenerated}`);
  console.log(`  previews:   ${previewsGenerated}`);
  console.log(`  prompts:    ${promptsGenerated}`);
  if (failures.length > 0) {
    console.log(`  failures:`);
    for (const f of failures) console.log(`    - ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
