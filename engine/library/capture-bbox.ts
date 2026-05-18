/**
 * Playwright-based per-section bounding box capture.
 *
 * Boots a local static server against the built dist, opens each parent
 * page once, and resolves a DOM element for every section that lives on
 * that page. The element's boundingBox() is recorded so the preview modal
 * can crop the iframe to the section.
 *
 * Selector strategy:
 *   - Header  -> the page's `header` landmark
 *   - Footer  -> the page's `footer` landmark
 *   - Main sub-section -> by index among visible top-level blocks under
 *     the page wrapper. The extractor passes the child index so we can find
 *     the matching DOM node without parsing JSX twice.
 *   - Optional name-match fallback: try to locate by heading text.
 */
import { spawn, type ChildProcess } from "node:child_process";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";

export interface BBoxRequest {
  sku: string;
  pageEntry: string; // e.g. "index.html"
  role: "header" | "footer" | "main" | "shared";
  /** Zero-based index among visible top-level wrapper children. -1 if not applicable. */
  mainChildIndex: number;
  /** Optional heading to use as a name-match fallback */
  headingText?: string | null;
}

export interface BBoxResult {
  sku: string;
  bbox: { x: number; y: number; width: number; height: number } | null;
  reason?: string;
}

export interface CaptureBBoxOptions {
  buildDir: string;
  port: number;
  requests: BBoxRequest[];
  viewportWidth: number;
  viewportHeight: number;
  onProgress?: (msg: string) => void;
}

interface ServerHandle {
  proc: ChildProcess;
  baseUrl: string;
  close: () => Promise<void>;
}

async function startServer(buildDir: string, port: number): Promise<ServerHandle> {
  const proc = spawn(
    "npx",
    ["--yes", "serve", "-l", String(port), "-n", buildDir],
    { stdio: ["ignore", "pipe", "pipe"], detached: false },
  );
  const baseUrl = `http://localhost:${port}`;
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`static server failed to start on port ${port}`)),
      15000,
    );
    const tryConnect = () => {
      void fetch(baseUrl)
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch(() => setTimeout(tryConnect, 300));
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
      await new Promise((r) => setTimeout(r, 200));
      if (!proc.killed) proc.kill("SIGKILL");
    },
  };
}

/**
 * Browser-side functions. No nested function declarations — esbuild/tsx
 * injects a `__name` helper for nested functions which is undefined in the
 * page context and throws ReferenceError inside page.evaluate.
 */
function findMainChildBox(index: number): { x: number; y: number; width: number; height: number } | null {
  const candidates = [
    ".entry-content",
    ".content-wrapper .entry-content",
    "main .entry-content",
    "main",
    "body > div",
  ];
  let wrapper: Element | null = null;
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && el.children.length > 1) {
      wrapper = el;
      break;
    }
  }
  if (!wrapper) wrapper = document.body;

  const blocks: Element[] = [];
  for (const child of Array.from(wrapper.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === "style" || tag === "script" || tag === "link" || tag === "meta") continue;
    if (tag === "header" || tag === "footer") continue;
    const rect = child.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 4) continue;
    blocks.push(child);
  }
  const target = blocks[index];
  if (!target) return null;
  const r = target.getBoundingClientRect();
  return {
    x: r.left + window.scrollX,
    y: r.top + window.scrollY,
    width: r.width,
    height: r.height,
  };
}

function findHeaderBox(): { x: number; y: number; width: number; height: number } | null {
  const el =
    document.querySelector("header") ||
    document.querySelector(".site-header") ||
    document.querySelector("[role='banner']");
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
}

function findFooterBox(): { x: number; y: number; width: number; height: number } | null {
  const el =
    document.querySelector("footer") ||
    document.querySelector(".site-footer") ||
    document.querySelector("[role='contentinfo']");
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
}

async function settleScroll(): Promise<void> {
  const totalHeight = document.body.scrollHeight;
  let y = 0;
  while (y < totalHeight) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
    y += window.innerHeight;
  }
  window.scrollTo(0, 0);
}

function sectionBoxFromHeading(el: HTMLElement): { x: number; y: number; width: number; height: number } | null {
  let cur: HTMLElement | null = el;
  let levels = 0;
  while (cur && cur.parentElement && levels < 6) {
    const rect = cur.getBoundingClientRect();
    if (rect.height > window.innerHeight * 0.4) {
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    }
    cur = cur.parentElement;
    levels += 1;
  }
  return null;
}

async function captureForPage(
  page: Page,
  requests: BBoxRequest[],
  onProgress?: (msg: string) => void,
): Promise<BBoxResult[]> {
  const out: BBoxResult[] = [];

  // Force eager scroll-through so any lazy/animated content settles its layout.
  try {
    await page.evaluate(settleScroll);
  } catch {
    // ignore
  }
  await page.waitForTimeout(400);

  for (const req of requests) {
    try {
      let box: { x: number; y: number; width: number; height: number } | null = null;
      if (req.role === "header") {
        box = await page.evaluate(findHeaderBox);
      } else if (req.role === "footer") {
        box = await page.evaluate(findFooterBox);
      } else {
        box = await page.evaluate(findMainChildBox, req.mainChildIndex);
      }

      if (!box && req.headingText) {
        const headingLoc = page.getByText(req.headingText, { exact: false }).first();
        if (await headingLoc.count()) {
          const handle = await headingLoc.elementHandle();
          if (handle) {
            const sectionBox = (await page.evaluate(
              sectionBoxFromHeading as unknown as (el: Element) => { x: number; y: number; width: number; height: number } | null,
              handle,
            )) as { x: number; y: number; width: number; height: number } | null;
            if (sectionBox) box = sectionBox;
          }
        }
      }

      if (box && box.height >= 8 && box.width >= 8) {
        out.push({
          sku: req.sku,
          bbox: {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
          },
        });
        onProgress?.(`bbox ${req.sku} ${Math.round(box.width)}x${Math.round(box.height)} @ y=${Math.round(box.y)}`);
      } else {
        out.push({ sku: req.sku, bbox: null, reason: "no-element" });
        onProgress?.(`bbox ${req.sku} skipped (no element)`);
      }
    } catch (err) {
      out.push({ sku: req.sku, bbox: null, reason: (err as Error).message });
    }
  }

  return out;
}

export async function captureBoundingBoxes(opts: CaptureBBoxOptions): Promise<BBoxResult[]> {
  const server = await startServer(opts.buildDir, opts.port);
  let browser: Browser | null = null;
  const all: BBoxResult[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: opts.viewportWidth, height: opts.viewportHeight },
      deviceScaleFactor: 1,
    });

    // Group requests by parent page.
    const byPage = new Map<string, BBoxRequest[]>();
    for (const r of opts.requests) {
      const list = byPage.get(r.pageEntry) ?? [];
      list.push(r);
      byPage.set(r.pageEntry, list);
    }

    for (const [entry, reqs] of byPage) {
      const url = `${server.baseUrl}/${entry}`;
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(4000);
      } catch (err) {
        opts.onProgress?.(`warn: ${entry} load failed: ${(err as Error).message}`);
      }

      const pageResults = await captureForPage(page, reqs, opts.onProgress);
      all.push(...pageResults);

      await page.close();
    }

    await context.close();
  } finally {
    if (browser) await browser.close();
    await server.close();
  }

  return all;
}
