/**
 * Playwright-based section thumbnail renderer.
 *
 * Boots a local static server against the built dist (or the project root
 * if a `dist` is not available) and visits each page once, screenshotting
 * each section that maps to that page.
 *
 * Heuristic for locating a section on the page:
 *   1. The component's outermost class (we parse it from the source).
 *   2. The first heading text inside the component source.
 *   3. Fallback: screenshot the page hero area (top 800x500).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import type { PlannedSection } from "./extract-react-build";

export interface RenderOptions {
  buildDir: string;
  port: number;
  pagesByEntry: Record<string, { slug: string; title: string; entry: string }>;
  sections: PlannedSection[];
  thumbnailWidth: number;
  thumbnailHeight: number;
  onProgress?: (msg: string) => void;
}

export interface RenderResult {
  sku: string;
  png: Buffer | null;
  reason?: string;
}

interface ServerHandle {
  proc: ChildProcess;
  baseUrl: string;
  close: () => Promise<void>;
}

async function startServer(buildDir: string, port: number): Promise<ServerHandle> {
  // Use npx serve with -s for SPA-style, but we want multi-page so no -s.
  // serve from the build dir (which has the html entries) on the requested port.
  const proc = spawn(
    "npx",
    ["--yes", "serve", "-l", String(port), "-n", buildDir],
    {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    },
  );

  const baseUrl = `http://localhost:${port}`;

  // Wait for the server to accept a TCP connection.
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`static server failed to start within 15s on port ${port}`));
    }, 15000);

    const tryConnect = () => {
      void fetch(baseUrl)
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch(() => {
          setTimeout(tryConnect, 300);
        });
    };

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    setTimeout(tryConnect, 300);
  });

  return {
    proc,
    baseUrl,
    close: async () => {
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 250));
      if (!proc.killed) proc.kill("SIGKILL");
    },
  };
}

function extractOutermostClass(source: string): string | null {
  // First className="..." after a JSX tag open.
  const m = source.match(/<[A-Za-z][\w-]*[^>]*\bclassName=["']([^"']+)["']/);
  if (!m) return null;
  // Use only the first token of the class attribute, the most identifying one.
  return m[1].split(/\s+/)[0] ?? null;
}

function extractFirstHeading(source: string): string | null {
  const m = source.match(/<h[1-6][^>]*>([^<]{3,})</);
  return m ? m[1].trim() : null;
}

async function screenshotSectionOnPage(opts: {
  page: Page;
  section: PlannedSection;
  width: number;
  height: number;
}): Promise<Buffer | null> {
  const cls = extractOutermostClass(opts.section.source);
  const heading = extractFirstHeading(opts.section.source);

  // Try class-based selector first.
  if (cls) {
    const escaped = cls.replace(/"/g, '\\"');
    try {
      const handle = await opts.page.$(`.${cssEscape(cls)}`);
      if (handle) {
        await handle.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined);
        await opts.page.waitForTimeout(400);
        const png = await handle.screenshot({ type: "png" }).catch(() => null);
        if (png && png.length > 0) {
          return await clampImage(png, opts.width, opts.height, opts.page);
        }
      }
      void escaped;
    } catch {
      // fall through
    }
  }

  if (heading) {
    try {
      const headingLoc = opts.page.getByText(heading, { exact: false }).first();
      if (await headingLoc.count()) {
        const box = await headingLoc.boundingBox();
        if (box) {
          await opts.page.mouse.wheel(0, Math.max(0, box.y - 80));
          await opts.page.waitForTimeout(400);
          const png = await opts.page.screenshot({
            type: "png",
            clip: {
              x: 0,
              y: Math.max(0, box.y - 40),
              width: Math.min(opts.width, opts.page.viewportSize()?.width ?? opts.width),
              height: opts.height,
            },
          });
          return png;
        }
      }
    } catch {
      // fall through
    }
  }

  // Fallback: top of page.
  try {
    const png = await opts.page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: opts.width, height: opts.height },
    });
    return png;
  } catch {
    return null;
  }
}

function cssEscape(value: string): string {
  // Minimal CSS.escape polyfill. Only handles selectors we care about.
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

async function clampImage(
  _png: Buffer,
  _width: number,
  _height: number,
  _page: Page,
): Promise<Buffer> {
  // No clamping done here. Playwright's element screenshot already gives us
  // the bounding box. Returning as-is keeps native resolution.
  return _png;
}

export async function renderSectionThumbnails(opts: RenderOptions): Promise<RenderResult[]> {
  await mkdir(join(opts.buildDir), { recursive: true });

  const server = await startServer(opts.buildDir, opts.port);
  let browser: Browser | null = null;
  const results: RenderResult[] = [];

  try {
    browser = await chromium.launch({ headless: true });

    // Group sections by page.
    const byPage = new Map<string, PlannedSection[]>();
    for (const s of opts.sections) {
      const pageKey = s.isShared ? "index" : s.page;
      const list = byPage.get(pageKey) ?? [];
      list.push(s);
      byPage.set(pageKey, list);
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    for (const [pageSlug, pageSections] of byPage) {
      const entry = opts.pagesByEntry[pageSlug];
      if (!entry) {
        opts.onProgress?.(`skip page ${pageSlug}, no html entry`);
        for (const s of pageSections) {
          results.push({ sku: s.sku, png: null, reason: "no-page-entry" });
        }
        continue;
      }
      const url = `${server.baseUrl}/${entry.entry}`;
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(800);
      } catch (err) {
        opts.onProgress?.(`warn: load failed for ${url}: ${(err as Error).message}`);
      }

      for (const section of pageSections) {
        opts.onProgress?.(`shot ${section.sku} on ${pageSlug}`);
        const png = await screenshotSectionOnPage({
          page,
          section,
          width: opts.thumbnailWidth,
          height: opts.thumbnailHeight,
        });
        results.push({ sku: section.sku, png, reason: png ? undefined : "shot-failed" });
      }

      await page.close();
    }

    await context.close();
  } finally {
    if (browser) await browser.close();
    await server.close();
  }

  return results;
}
