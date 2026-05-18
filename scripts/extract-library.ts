#!/usr/bin/env tsx
/**
 * extract-library CLI driver.
 *
 * Walks a multi-page Vite + React build, emits a catalogue under
 * <output>/sites/<site-id>/ with one folder per section. Also builds the
 * React project and copies its `dist/` into the site folder so the
 * dashboard can iframe-embed real pages for live previews.
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
  writeSection,
  writeSite,
  writeThumbnail,
} from "../engine/library/write-catalogue";
import { bundleDist } from "../engine/library/bundle-dist";
import { captureBoundingBoxes, type BBoxRequest } from "../engine/library/capture-bbox";
import { isProjectType, type ProjectType, type Site } from "../engine/library/types";

interface CliArgs {
  reactBuild: string;
  siteId: string;
  siteName: string;
  domain: string;
  projectTypes: ProjectType[];
  output: string;
  includeShared: boolean;
  force: boolean;
  skipBuild: boolean;
  distOnly: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: Partial<CliArgs> & { projectTypes: ProjectType[] } = {
    projectTypes: [],
    includeShared: true,
    force: false,
    skipBuild: false,
    distOnly: false,
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
      case "skip-build":
        out.skipBuild = value !== "false";
        break;
      case "dist-only":
        out.distOnly = value !== "false";
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

  return {
    reactBuild: resolve(out.reactBuild!),
    siteId: out.siteId!,
    siteName: out.siteName!,
    domain: out.domain!,
    projectTypes: out.projectTypes,
    output: resolve(out.output!),
    includeShared: out.includeShared ?? true,
    force: out.force ?? false,
    skipBuild: out.skipBuild ?? false,
    distOnly: out.distOnly ?? false,
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

async function refreshDistOnly(args: CliArgs): Promise<void> {
  const siteRoot = `${args.output}/sites/${args.siteId}`;
  if (!existsSync(siteRoot)) {
    fail(`--dist-only requires an existing site at ${siteRoot}`);
  }

  console.log(`extract-library: --dist-only mode, refreshing ${siteRoot}/dist`);
  const distDest = `${siteRoot}/dist`;
  if (existsSync(distDest)) {
    rmSync(distDest, { recursive: true, force: true });
  }

  const result = await bundleDist({
    reactBuildDir: args.reactBuild,
    siteOutDir: siteRoot,
    skipBuild: args.skipBuild,
    onProgress: (m) => console.log(`    ${m}`),
  });

  console.log(`\nextract-library --dist-only done`);
  console.log(`  built:       ${result.built}`);
  console.log(`  distSize:    ${(result.distSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  pages:       ${result.distPagesCount} (${result.pageSlugs.join(", ")})`);
  console.log(`  note:        site.json was NOT updated. Re-run a full extract to refresh metadata.`);
  if (result.oversizedFiles.length > 0) {
    console.warn(`  WARNING: ${result.oversizedFiles.length} file(s) exceed GitHub's 100MB limit:`);
    for (const f of result.oversizedFiles) console.warn(`    - ${f}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const capturedAt = new Date().toISOString();

  if (args.distOnly) {
    await refreshDistOnly(args);
    return;
  }

  console.log(`extract-library starting`);
  console.log(`  react-build: ${args.reactBuild}`);
  console.log(`  site-id:     ${args.siteId}`);
  console.log(`  output:      ${args.output}`);
  console.log(`  project-type:${args.projectTypes.join(", ")}`);
  console.log(`  shared:      ${args.includeShared}`);
  console.log(`  skip-build:  ${args.skipBuild}`);

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

  // Capture per-section bounding boxes from the built dist so the dashboard
  // can crop iframe previews to each section.
  const buildDirForBbox = pickBuildDir(args.reactBuild);
  const bboxRequests: BBoxRequest[] = plan.sections.map((s) => ({
    sku: s.sku,
    pageEntry: s.meta.parentPagePath ?? "index.html",
    role: s.role,
    mainChildIndex: s.mainChildIndex,
    headingText: s.headingText,
  }));
  console.log(`  bbox: capturing ${bboxRequests.length} bounding boxes from ${buildDirForBbox}`);
  let bboxAttached = 0;
  let bboxFailed = 0;
  try {
    const bboxResults = await captureBoundingBoxes({
      buildDir: buildDirForBbox,
      port: 47214,
      requests: bboxRequests,
      viewportWidth: 1440,
      viewportHeight: 900,
      onProgress: (m) => console.log(`    ${m}`),
    });
    const bySku = new Map(bboxResults.map((r) => [r.sku, r] as const));
    for (const section of plan.sections) {
      const res = bySku.get(section.sku);
      if (res && res.bbox) {
        section.meta.boundingBox = res.bbox;
        section.meta.boundingBoxViewportWidth = 1440;
        bboxAttached += 1;
      } else {
        bboxFailed += 1;
      }
    }
  } catch (err) {
    console.warn(`bbox capture failed: ${(err as Error).message}`);
  }
  console.log(`  bbox: attached ${bboxAttached}, failed ${bboxFailed}`);

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

  // Build + bundle the React dist into the site folder for live previews.
  console.log(`  bundle: building React project and copying dist`);
  const distDest = `${siteRoot}/dist`;
  if (existsSync(distDest)) {
    rmSync(distDest, { recursive: true, force: true });
  }
  const bundle = await bundleDist({
    reactBuildDir: args.reactBuild,
    siteOutDir: siteRoot,
    skipBuild: args.skipBuild,
    onProgress: (m) => console.log(`    ${m}`),
  });
  console.log(`  bundle: ${bundle.distPagesCount} html pages, ${(bundle.distSize / (1024 * 1024)).toFixed(2)} MB total`);
  if (bundle.oversizedFiles.length > 0) {
    console.warn(`  WARNING: ${bundle.oversizedFiles.length} file(s) exceed GitHub's 100MB limit and will be skipped at push:`);
    for (const f of bundle.oversizedFiles) console.warn(`    - ${f}`);
  }

  const siteWithDist: Site = {
    ...plan.site,
    distPath: bundle.distPath,
    distSize: bundle.distSize,
    distPagesCount: bundle.distPagesCount,
  };
  await writeSite(args.output, siteWithDist);

  console.log(`\nextract-library done`);
  console.log(`  sites:      1`);
  console.log(`  sections:   ${plan.sections.length}`);
  console.log(`  thumbnails: ${thumbnailsGenerated}`);
  console.log(`  previews:   ${previewsGenerated}`);
  console.log(`  prompts:    ${promptsGenerated}`);
  console.log(`  dist:       ${bundle.distPagesCount} pages, ${(bundle.distSize / (1024 * 1024)).toFixed(2)} MB`);
  if (failures.length > 0) {
    console.log(`  failures:`);
    for (const f of failures) console.log(`    - ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
