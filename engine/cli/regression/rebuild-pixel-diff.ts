/**
 * Rebuild-pixel-diff comparison mode for the regression corpus.
 *
 * V1 spec per Cameron: "rebuild the fixture, screenshot every viewport,
 * pixel-diff against reference". W5C wires this into `parity test`.
 *
 * Sequence (per fixture, per viewport):
 *   1. Rebuild the fixture's capture-ref via the appropriate target
 *      adapter into an isolated tmp project dir.
 *   2. For astro/react: run `npm install` (skipped if a sibling
 *      .pnpm-store or existing node_modules cache is found) and
 *      `npm run build` to produce dist/.
 *   3. Boot a static server on the rebuilt dist/ via engine/verify/ports.
 *   4. Boot a sibling server on the original clone dir.
 *   5. Capture full-page screenshots of both at the fixture's viewport.
 *   6. Pixel-diff via engine/verify/diff. Pass if diffRatio <= 1 -
 *      parityThreshold.
 *
 * Each fixture's screenshots and diff PNG land under
 *   <fixtureDir>/rebuild-pixel-diff/<viewport>/
 * (gitignored, but kept around for the most recent run for debugging).
 *
 * Webapp fixtures use a slightly different path: the webapp post-emit
 * already has a dedicated pixel parity stage (see
 * engine/orchestrator/post-build/webapp-pixel-parity.ts). For corpus
 * purposes we treat webapp identically to astro: rebuild, vite build,
 * preview, screenshot, diff.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { astroAdapter } from "../../targets/astro/index.js";
import { reactAdapter } from "../../targets/react/index.js";
import { bootServer } from "../../verify/ports.js";
import { captureAll, launchBrowser } from "../../verify/screenshots.js";
import { diffShot } from "../../verify/diff.js";
import type { Viewport } from "../../verify/types.js";
import type { ComparisonResult } from "./manifest-shape.js";
import type { Fixture } from "./fixture-schema.js";

const FIXTURE_VIEWPORTS: Record<string, Viewport> = {
  mobile: { name: "mobile", width: 375, height: 812, dsf: 2 },
  tablet: { name: "tablet", width: 768, height: 1024, dsf: 2 },
  desktop: { name: "desktop", width: 1280, height: 800, dsf: 1 },
  wide: { name: "wide", width: 1920, height: 1080, dsf: 1 },
};

function viewportFor(fixture: Fixture): Viewport {
  const vp = FIXTURE_VIEWPORTS[fixture.viewport];
  if (!vp) {
    throw new Error(
      `rebuild-pixel-diff: unknown viewport ${fixture.viewport} for fixture ${fixture.slug}`,
    );
  }
  return vp;
}

function runNpm(
  args: readonly string[],
  cwd: string,
  log: (line: string) => void,
): Promise<number> {
  return new Promise((resolveExit) => {
    const child = spawn("npm", args as string[], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    child.stdout?.on("data", (b: Buffer) =>
      log(b.toString("utf8").replace(/\s+$/, "")),
    );
    child.stderr?.on("data", (b: Buffer) =>
      log(b.toString("utf8").replace(/\s+$/, "")),
    );
    child.on("error", (err) => {
      log(`npm spawn error: ${err.message}`);
      resolveExit(1);
    });
    child.on("exit", (code) => resolveExit(code ?? 0));
  });
}

export interface RebuildPixelDiffInput {
  readonly fixture: Fixture;
  readonly repoRoot: string;
  /**
   * Skip running `npm install`. Defaults to true when the project tmp dir
   * already contains node_modules (caller is responsible). Useful in tests.
   */
  readonly skipInstall?: boolean;
  /** Skip the build step. Useful in tests when caller supplies dist/. */
  readonly skipBuild?: boolean;
  /** Override the log sink. Defaults to silent. */
  readonly log?: (line: string) => void;
  /** Override the output directory for screenshots + diffs. */
  readonly outDir?: string;
}

function defaultLog(_line: string): void {
  // silent by default; the runner narrates per-fixture lines itself
}

async function rebuildAstro(
  cloneDir: string,
  outDir: string,
  name: string,
): Promise<void> {
  await astroAdapter.build({
    cloneDir,
    outDir,
    name,
    force: true,
  });
}

async function rebuildReact(
  cloneDir: string,
  outDir: string,
  name: string,
): Promise<void> {
  await reactAdapter.build({
    cloneDir,
    outDir,
    name,
    force: true,
  });
}

/**
 * Rebuild the fixture's capture-ref via the target adapter, run npm
 * install + build, boot a server on the dist directory, capture
 * screenshots, and pixel-diff against the original clone.
 */
export async function compareRebuildPixelDiff(
  input: RebuildPixelDiffInput,
): Promise<ComparisonResult> {
  const log = input.log ?? defaultLog;
  const { fixture } = input;

  if (fixture.target !== "astro" && fixture.target !== "react") {
    return {
      passed: false,
      score: 0,
      summary: `rebuild-pixel-diff: target ${fixture.target} not yet supported (only astro and react)`,
      diagnostics: [],
    };
  }

  const cloneDir = resolve(input.repoRoot, fixture.captureRef);
  if (!existsSync(cloneDir)) {
    return {
      passed: false,
      score: 0,
      summary: `rebuild-pixel-diff: clone dir not found at ${cloneDir}`,
      diagnostics: [],
    };
  }

  const viewport = viewportFor(fixture);
  const projectName = `corpus-${fixture.slug}`;
  const projectDir = await mkdtemp(join(tmpdir(), `dr-parity-rebuild-${fixture.slug}-`));
  const screenshotsRoot = input.outDir
    ? resolve(input.outDir)
    : join(fixture.dir, "rebuild-pixel-diff");

  // Clear and re-create the screenshot directory so stale diffs from a
  // previous run do not leak into this one.
  if (existsSync(screenshotsRoot)) {
    rmSync(screenshotsRoot, { recursive: true, force: true });
  }
  mkdirSync(screenshotsRoot, { recursive: true });

  const diagnostics: string[] = [];

  try {
    log(`rebuild-pixel-diff[${fixture.slug}]: rebuilding into ${projectDir}`);

    if (fixture.target === "astro") {
      await rebuildAstro(cloneDir, projectDir, projectName);
    } else {
      await rebuildReact(cloneDir, projectDir, projectName);
    }

    if (!input.skipInstall) {
      log(`rebuild-pixel-diff[${fixture.slug}]: npm install`);
      const installCode = await runNpm(["install", "--silent"], projectDir, log);
      if (installCode !== 0) {
        diagnostics.push(`npm install exited ${installCode}`);
        return {
          passed: false,
          score: 0,
          summary: "rebuild-pixel-diff: npm install failed",
          diagnostics,
        };
      }
    }

    if (!input.skipBuild) {
      log(`rebuild-pixel-diff[${fixture.slug}]: npm run build`);
      const buildCode = await runNpm(["run", "build"], projectDir, log);
      if (buildCode !== 0) {
        diagnostics.push(`npm run build exited ${buildCode}`);
        return {
          passed: false,
          score: 0,
          summary: "rebuild-pixel-diff: build failed",
          diagnostics,
        };
      }
    }

    const distDir = join(projectDir, "dist");
    if (!existsSync(join(distDir, "index.html"))) {
      diagnostics.push(`dist/index.html missing under ${distDir}`);
      return {
        passed: false,
        score: 0,
        summary: "rebuild-pixel-diff: dist/index.html missing after build",
        diagnostics,
      };
    }

    log(`rebuild-pixel-diff[${fixture.slug}]: booting servers`);
    const cloneServer = await bootServer(cloneDir, await pickPort(5070));
    let rebuiltServer;
    try {
      rebuiltServer = await bootServer(distDir, await pickPort(5071));
    } catch (err) {
      cloneServer.kill();
      throw err;
    }

    try {
      log(`rebuild-pixel-diff[${fixture.slug}]: screenshotting ${viewport.name}`);
      const browser = await launchBrowser();
      try {
        const shots = await captureAll(
          browser,
          cloneServer.url,
          rebuiltServer.url,
          [viewport],
          screenshotsRoot,
        );
        const shot = shots[0];
        if (!shot) {
          diagnostics.push("captureAll returned no shots");
          return {
            passed: false,
            score: 0,
            summary: "rebuild-pixel-diff: no screenshots produced",
            diagnostics,
          };
        }

        const threshold = 1 - fixture.parityThreshold;
        const result = await diffShot(
          {
            viewport: shot.viewport,
            clonePath: shot.clonePath,
            rebuiltPath: shot.rebuiltPath,
          },
          threshold,
        );

        const score = 1 - result.diffRatio;
        const passed = result.pass;
        if (!passed) {
          diagnostics.push(
            `viewport ${viewport.name}: diffRatio ${(result.diffRatio * 100).toFixed(3)}% exceeds threshold ${(threshold * 100).toFixed(3)}% (${result.mismatchedPixels}/${result.totalPixels} px)`,
          );
        }

        return {
          passed,
          score,
          summary: passed
            ? `rebuild-pixel-diff match (viewport=${viewport.name} score=${(score * 100).toFixed(2)}%)`
            : `rebuild-pixel-diff fail (viewport=${viewport.name} score=${(score * 100).toFixed(2)}%)`,
          diagnostics,
        };
      } finally {
        try {
          await browser.close();
        } catch {}
      }
    } finally {
      cloneServer.kill();
      rebuiltServer.kill();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.push(message);
    return {
      passed: false,
      score: 0,
      summary: `rebuild-pixel-diff: error during rebuild or diff`,
      diagnostics,
    };
  } finally {
    try {
      rmSync(projectDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Pick a free port starting from `from`. We re-implement a tiny version
 * here rather than reuse engine/verify/ports.pickFreePorts because we
 * want independent port pools per fixture and per server boot.
 */
async function pickPort(from: number): Promise<number> {
  const net = await import("node:net");
  for (let port = from; port < from + 50; port++) {
    const free = await new Promise<boolean>((res) => {
      const server = net.createServer();
      server.once("error", () => res(false));
      server.once("listening", () => server.close(() => res(true)));
      server.listen(port, "127.0.0.1");
    });
    if (free) return port;
  }
  throw new Error(`No free port in range ${from}-${from + 50}`);
}
