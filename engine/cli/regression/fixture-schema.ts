/**
 * Regression corpus fixture schema and loader.
 *
 * Phase 3d / W2C per docs/V2.0/05-action-plan.md section 3.
 *
 * Reads every `tests/fixtures/sites/<slug>/fixture.json` and returns a
 * typed list. The loader is intentionally strict: a malformed fixture
 * causes `parity test` to exit with a non-zero status before the gate
 * runs, since silent skips are exactly the failure mode the corpus is
 * supposed to prevent.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export type FixtureTarget = "astro" | "react" | "webapp";
export type ComparisonMode =
  | "bytes"
  | "pixel-diff"
  | "manifest-shape"
  | "both";

export interface Fixture {
  readonly slug: string;
  readonly target: FixtureTarget;
  readonly url: string;
  readonly capturedAt: string;
  readonly parityThreshold: number;
  readonly comparisonMode: ComparisonMode;
  readonly notes: string;
  readonly dir: string;
  readonly captureRef: string;
}

const VALID_TARGETS: ReadonlySet<FixtureTarget> = new Set([
  "astro",
  "react",
  "webapp",
]);

const VALID_COMPARISON_MODES: ReadonlySet<ComparisonMode> = new Set([
  "bytes",
  "pixel-diff",
  "manifest-shape",
  "both",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string, slug: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `fixture ${slug}: field "${field}" must be a non-empty string`,
    );
  }
  return value;
}

function assertNumber(value: unknown, field: string, slug: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(
      `fixture ${slug}: field "${field}" must be a finite number`,
    );
  }
  return value;
}

function assertTarget(value: unknown, slug: string): FixtureTarget {
  const str = assertString(value, "target", slug);
  if (!VALID_TARGETS.has(str as FixtureTarget)) {
    throw new Error(
      `fixture ${slug}: target "${str}" must be one of astro, react, webapp`,
    );
  }
  return str as FixtureTarget;
}

function assertComparisonMode(value: unknown, slug: string): ComparisonMode {
  const str = assertString(value, "comparison_mode", slug);
  if (!VALID_COMPARISON_MODES.has(str as ComparisonMode)) {
    throw new Error(
      `fixture ${slug}: comparison_mode "${str}" must be one of bytes, pixel-diff, manifest-shape, both`,
    );
  }
  return str as ComparisonMode;
}

async function readFixture(dir: string, slug: string): Promise<Fixture> {
  const fixturePath = join(dir, "fixture.json");
  const raw = await readFile(fixturePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`fixture ${slug}: invalid JSON. ${message}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`fixture ${slug}: top-level must be an object`);
  }

  const fixtureSlug = assertString(parsed.slug, "slug", slug);
  if (fixtureSlug !== slug) {
    throw new Error(
      `fixture ${slug}: fixture.json#slug "${fixtureSlug}" does not match directory name`,
    );
  }

  const captureRefPath = join(dir, "capture-ref", "source.txt");
  let captureRef = "";
  try {
    const captureRefRaw = await readFile(captureRefPath, "utf8");
    captureRef = captureRefRaw.split("\n")[0]?.trim() ?? "";
  } catch {
    captureRef = "";
  }

  return {
    slug: fixtureSlug,
    target: assertTarget(parsed.target, slug),
    url: assertString(parsed.url, "url", slug),
    capturedAt: assertString(parsed.captured_at, "captured_at", slug),
    parityThreshold: assertNumber(parsed.parity_threshold, "parity_threshold", slug),
    comparisonMode: assertComparisonMode(parsed.comparison_mode, slug),
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    dir,
    captureRef,
  };
}

/**
 * Walk `tests/fixtures/sites/` and load every fixture.json.
 * Returns an empty array if the directory does not exist.
 */
export async function loadFixtures(repoRoot: string): Promise<readonly Fixture[]> {
  const sitesDir = resolve(repoRoot, "tests", "fixtures", "sites");
  let entries: string[];
  try {
    entries = await readdir(sitesDir);
  } catch {
    return [];
  }

  const fixtures: Fixture[] = [];
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const dir = join(sitesDir, entry);
    try {
      const fixture = await readFixture(dir, entry);
      fixtures.push(fixture);
    } catch (err) {
      if (err instanceof Error && err.message.includes("ENOENT")) {
        // Directory has no fixture.json yet; skip.
        continue;
      }
      throw err;
    }
  }

  return fixtures.sort((a, b) => a.slug.localeCompare(b.slug));
}
