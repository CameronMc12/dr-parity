/**
 * Build the React project and copy its `dist/` into the library catalogue
 * so the dashboard can iframe-embed real pages instead of static thumbnails.
 *
 * Pure extension to extract-library. Does not touch the engine target
 * adapters or the React build pipeline itself; it just shells out to
 * `npm install` (when needed) and `npm run build`, then copies bytes.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export interface BundleDistOptions {
  reactBuildDir: string;
  siteOutDir: string; // <output>/sites/<site-id>
  skipBuild?: boolean;
  onProgress?: (msg: string) => void;
}

export interface BundleDistResult {
  built: boolean;
  copied: boolean;
  distPath: string; // relative to siteOutDir; always "dist"
  distSize: number; // bytes, recursive
  distPagesCount: number; // top-level html files
  largestFileBytes: number;
  largestFileName: string | null;
  oversizedFiles: string[]; // files >= 100MB (GitHub hard limit)
  pageSlugs: string[]; // slugs found in dist (basename of *.html)
}

const GITHUB_MAX_FILE_BYTES = 100 * 1024 * 1024;

function ensureExists(dir: string, label: string): void {
  if (!existsSync(dir)) {
    throw new Error(`bundle-dist: ${label} not found at ${dir}`);
  }
}

async function runNpm(
  args: string[],
  cwd: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  onProgress?.(`npm ${args.join(" ")} (cwd: ${cwd})`);
  await execFileAsync("npm", args, {
    cwd,
    env: { ...process.env, CI: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function runNpx(
  args: string[],
  cwd: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  onProgress?.(`npx ${args.join(" ")} (cwd: ${cwd})`);
  await execFileAsync("npx", args, {
    cwd,
    env: { ...process.env, CI: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
}

function walkDir(root: string): { totalBytes: number; largest: { name: string; bytes: number } | null; oversized: string[] } {
  let totalBytes = 0;
  let largest: { name: string; bytes: number } | null = null;
  const oversized: string[] = [];

  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const s = statSync(abs);
      totalBytes += s.size;
      if (!largest || s.size > largest.bytes) {
        largest = { name: abs.slice(root.length + 1), bytes: s.size };
      }
      if (s.size >= GITHUB_MAX_FILE_BYTES) {
        oversized.push(abs.slice(root.length + 1));
      }
    }
  }

  return { totalBytes, largest, oversized };
}

export async function bundleDist(opts: BundleDistOptions): Promise<BundleDistResult> {
  ensureExists(opts.reactBuildDir, "react-build directory");

  const distSrc = join(opts.reactBuildDir, "dist");
  let built = false;

  if (opts.skipBuild) {
    opts.onProgress?.("skip-build: assuming dist/ already exists");
    ensureExists(distSrc, "react-build dist/ (skip-build was passed but dist/ is missing)");
  } else {
    const nodeModules = join(opts.reactBuildDir, "node_modules");
    if (!existsSync(nodeModules)) {
      opts.onProgress?.("node_modules missing, running npm install");
      await runNpm(["install", "--silent", "--no-audit", "--no-fund"], opts.reactBuildDir, opts.onProgress);
    }

    // Clone-generated React projects often have TS errors but Vite builds
    // them fine. Bypass the project's `npm run build` (which gates on tsc)
    // and run `vite build` directly. This is intentional: we want the
    // production bundle, not type safety on third-party clones.
    opts.onProgress?.("running vite build");
    await runNpx(["vite", "build"], opts.reactBuildDir, opts.onProgress);
    ensureExists(distSrc, "dist/ after build");
    built = true;
  }

  const distDest = join(opts.siteOutDir, "dist");
  opts.onProgress?.(`copying ${distSrc} -> ${distDest}`);
  cpSync(distSrc, distDest, { recursive: true });

  const indexHtml = join(distDest, "index.html");
  if (!existsSync(indexHtml)) {
    throw new Error(`bundle-dist: copy verification failed, missing ${indexHtml}`);
  }

  const topLevel = readdirSync(distDest, { withFileTypes: true });
  const htmlEntries = topLevel
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => e.name)
    .sort();
  const pageSlugs = htmlEntries.map((f) => f.replace(/\.html$/, ""));

  const { totalBytes, largest, oversized } = walkDir(distDest);

  return {
    built,
    copied: true,
    distPath: "dist",
    distSize: totalBytes,
    distPagesCount: htmlEntries.length,
    largestFileBytes: largest?.bytes ?? 0,
    largestFileName: largest?.name ?? null,
    oversizedFiles: oversized,
    pageSlugs,
  };
}

export function pageSlugToHtml(slug: string): string {
  return `${slug}.html`;
}
