/**
 * Framework emit + parity verification stages for `parity clone`.
 *
 * W6 wires these into `runParityClone` so that a single-URL clone command
 * actually invokes the target adapter and produces a real framework project,
 * then pixel-diffs the rebuilt dist against the captured clone. Without
 * these stages `parity clone <url> astro` and `parity clone <url> react`
 * produced byte-identical static HTML and never wrote `sites/<target>/`.
 *
 * Design and rationale: docs/V2.0/observations/w6-parity-clone-framework-emit.md
 *
 * Mirrors the build-then-verify sequence in
 * engine/cli/regression/rebuild-pixel-diff.ts, but emits into the canonical
 * `<runRoot>/sites/<target>/` instead of a throwaway tmp dir.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import type { Browser } from "playwright";

import { astroAdapter } from "../targets/astro/index.js";
import { reactAdapter } from "../targets/react/index.js";
import { webappAdapter } from "../targets/webapp/index.js";
import type { TargetAdapter, TargetBuildSummary } from "../targets/types.js";
import { bootServer } from "../verify/ports.js";
import { captureAll, launchBrowser } from "../verify/screenshots.js";
import { diffShot } from "../verify/diff.js";
import type { Viewport } from "../verify/types.js";
import { siteDir, defaultTargetFromHost } from "./canonical-paths.js";

export type EmitTarget = "astro" | "react" | "webapp";

/** Per-target pixel diff threshold defaults. Source of truth: W5B.2. */
export const DEFAULT_PARITY_THRESHOLDS: Record<EmitTarget, number> = {
  astro: 0.02,
  react: 0.2,
  webapp: 0.2,
};

const DESKTOP_VIEWPORT: Viewport = {
  name: "desktop",
  width: 1280,
  height: 800,
  dsf: 1,
};

export interface EmitTargetInput {
  readonly target: EmitTarget;
  readonly captureRoot: string;
  readonly runRoot: string;
  /** Optional canonical target slug for the run (overrides host-derived default). */
  readonly targetSlug?: string;
  /** Project name written into package.json. Defaults to the host. */
  readonly projectName?: string;
}

export interface EmitTargetResult {
  readonly status: "ok" | "fail" | "skipped";
  readonly durationMs: number;
  readonly outDir?: string;
  readonly summary?: TargetBuildSummary;
  readonly skipReason?: string;
  readonly error?: string;
}

function pickAdapter(target: EmitTarget): TargetAdapter {
  if (target === "astro") return astroAdapter;
  if (target === "react") return reactAdapter;
  return webappAdapter;
}

/**
 * Locate the desktop clone dir under a capture root. Falls back to the first
 * viewport with a clone/index.html if desktop is missing.
 */
export function findCloneDir(captureRoot: string): string | null {
  const desktop = join(captureRoot, "desktop", "clone");
  if (existsSync(join(desktop, "index.html"))) return desktop;
  if (!existsSync(captureRoot)) return null;
  const entries = readdirSync(captureRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  for (const vp of entries) {
    const candidate = join(captureRoot, vp, "clone");
    if (existsSync(join(candidate, "index.html"))) return candidate;
  }
  return null;
}

/**
 * Resolve the emit output directory under `<runRoot>/sites/<target>/`.
 *
 * The canonical path helper `siteDir` takes a target slug and iso timestamp
 * separately. For `parity clone` we already have a concrete run root, so we
 * just join `sites/<framework>` onto it directly.
 */
function resolveSiteOutDir(runRoot: string, target: EmitTarget): string {
  return resolve(runRoot, "sites", target);
}

export async function runEmitTargetStage(
  input: EmitTargetInput,
): Promise<EmitTargetResult> {
  const t0 = Date.now();
  const cloneDir = findCloneDir(input.captureRoot);
  if (!cloneDir) {
    return {
      status: "skipped",
      durationMs: Date.now() - t0,
      skipReason: `no captured clone found under ${input.captureRoot}`,
    };
  }

  const outDir = resolveSiteOutDir(input.runRoot, input.target);
  const adapter = pickAdapter(input.target);

  try {
    const summary = await adapter.build({
      cloneDir,
      outDir,
      name: input.projectName ?? input.targetSlug ?? "cloned-site",
      force: true,
    });
    return {
      status: "ok",
      durationMs: Date.now() - t0,
      outDir,
      summary,
    };
  } catch (err) {
    return {
      status: "fail",
      durationMs: Date.now() - t0,
      outDir,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ParityCheckInput {
  readonly target: EmitTarget;
  readonly projectDir: string;
  readonly captureRoot: string;
  readonly runRoot: string;
  /** Max diff ratio allowed. 0.02 means up to 2% pixel diff is acceptable. */
  readonly diffThreshold: number;
  /** Optional logger sink for npm install/build output. */
  readonly log?: (line: string) => void;
}

export interface ParityCheckResult {
  readonly status: "ok" | "partial" | "fail" | "skipped";
  readonly durationMs: number;
  readonly score?: number;
  readonly diffThreshold: number;
  readonly reportPath?: string;
  readonly diagnostics: readonly string[];
  readonly skipReason?: string;
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

function defaultLog(_line: string): void {
  // silent by default
}

export async function runParityCheckStage(
  input: ParityCheckInput,
): Promise<ParityCheckResult> {
  const t0 = Date.now();
  const log = input.log ?? defaultLog;
  const diagnostics: string[] = [];

  const cloneDir = findCloneDir(input.captureRoot);
  if (!cloneDir) {
    return {
      status: "skipped",
      durationMs: Date.now() - t0,
      diffThreshold: input.diffThreshold,
      diagnostics: [],
      skipReason: `no captured clone found under ${input.captureRoot}`,
    };
  }

  if (input.target !== "astro" && input.target !== "react") {
    // Webapp emits a SPA whose static build does not visually mirror the
    // single captured page (it has its own crawled routes). The dedicated
    // webapp pixel parity post-emit phase covers this. Skip cleanly.
    return {
      status: "skipped",
      durationMs: Date.now() - t0,
      diffThreshold: input.diffThreshold,
      diagnostics: [],
      skipReason: `parity-check: target ${input.target} uses its own post-emit pixel parity stage`,
    };
  }

  log(`parity-check: npm install in ${input.projectDir}`);
  const installCode = await runNpm(
    ["install", "--silent"],
    input.projectDir,
    log,
  );
  if (installCode !== 0) {
    diagnostics.push(`npm install exited ${installCode}`);
    return {
      status: "fail",
      durationMs: Date.now() - t0,
      diffThreshold: input.diffThreshold,
      diagnostics,
    };
  }

  log(`parity-check: npm run build`);
  const buildCode = await runNpm(["run", "build"], input.projectDir, log);
  if (buildCode !== 0) {
    diagnostics.push(`npm run build exited ${buildCode}`);
    return {
      status: "fail",
      durationMs: Date.now() - t0,
      diffThreshold: input.diffThreshold,
      diagnostics,
    };
  }

  const distDir = join(input.projectDir, "dist");
  if (!existsSync(join(distDir, "index.html"))) {
    diagnostics.push(`dist/index.html missing under ${distDir}`);
    return {
      status: "fail",
      durationMs: Date.now() - t0,
      diffThreshold: input.diffThreshold,
      diagnostics,
    };
  }

  const reportsRoot = resolve(
    input.runRoot,
    "reports",
    "parity",
    input.target,
  );
  mkdirSync(reportsRoot, { recursive: true });

  log(`parity-check: booting servers (clone + dist)`);
  const cloneServer = await bootServer(cloneDir, await pickPort(5070));
  let rebuiltServer;
  try {
    rebuiltServer = await bootServer(distDir, await pickPort(5071));
  } catch (err) {
    cloneServer.kill();
    diagnostics.push(
      err instanceof Error ? err.message : String(err),
    );
    return {
      status: "fail",
      durationMs: Date.now() - t0,
      diffThreshold: input.diffThreshold,
      diagnostics,
    };
  }

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const shots = await captureAll(
      browser,
      cloneServer.url,
      rebuiltServer.url,
      [DESKTOP_VIEWPORT],
      reportsRoot,
    );
    const shot = shots[0];
    if (!shot) {
      diagnostics.push("captureAll returned no shots");
      return {
        status: "fail",
        durationMs: Date.now() - t0,
        diffThreshold: input.diffThreshold,
        diagnostics,
      };
    }

    const diff = await diffShot(
      {
        viewport: shot.viewport,
        clonePath: shot.clonePath,
        rebuiltPath: shot.rebuiltPath,
      },
      input.diffThreshold,
    );
    const score = 1 - diff.diffRatio;
    const passed = diff.pass;
    if (!passed) {
      diagnostics.push(
        `viewport ${shot.viewport.name}: diffRatio ${(diff.diffRatio * 100).toFixed(3)}% exceeds threshold ${(input.diffThreshold * 100).toFixed(3)}% (${diff.mismatchedPixels}/${diff.totalPixels} px)`,
      );
    }

    const reportPath = join(reportsRoot, "report.json");
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          target: input.target,
          captureRoot: input.captureRoot,
          projectDir: input.projectDir,
          distDir,
          diffThreshold: input.diffThreshold,
          score,
          passed,
          viewport: shot.viewport,
          diff: {
            cloneShot: diff.cloneShot,
            rebuiltShot: diff.rebuiltShot,
            diffShot: diff.diffShot,
            mismatchedPixels: diff.mismatchedPixels,
            totalPixels: diff.totalPixels,
            diffRatio: diff.diffRatio,
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    return {
      status: passed ? "ok" : "partial",
      durationMs: Date.now() - t0,
      score,
      diffThreshold: input.diffThreshold,
      reportPath,
      diagnostics,
    };
  } catch (err) {
    diagnostics.push(err instanceof Error ? err.message : String(err));
    return {
      status: "fail",
      durationMs: Date.now() - t0,
      diffThreshold: input.diffThreshold,
      diagnostics,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    rebuiltServer.kill();
    cloneServer.kill();
  }
}

/**
 * Derive the project name from a URL. Mirrors
 * `engine/cli/canonical-paths.defaultTargetFromHost` so the emitted
 * package.json name matches the canonical target slug.
 */
export function projectNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return defaultTargetFromHost(host);
  } catch {
    return "cloned-site";
  }
}
