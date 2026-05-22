/**
 * Manifest-shape comparison.
 *
 * Phase 3d / W2C per docs/V2.0/05-action-plan.md section 3.
 *
 * Compares the live clone manifest at the fixture's capture-ref path
 * against the locked baseline at `expected/clone-manifest.json`. Pass when
 * styles, scripts, assets, and unresolvedExternal counts match exactly and
 * htmlBytes is within 5 percent of the locked value.
 *
 * Tolerance is deliberately tighter than the fixture's parity_threshold
 * because the comparison is structural: a count mismatch is a regression,
 * not a noise floor.
 */

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

interface CloneManifest {
  readonly viewport?: string;
  readonly htmlBytes?: number;
  readonly styles?: number;
  readonly scripts?: number;
  readonly assets?: number;
  readonly unresolvedExternal?: number;
  readonly documentUrl?: string;
}

export interface ComparisonResult {
  readonly passed: boolean;
  readonly score: number;
  readonly summary: string;
  readonly diagnostics: readonly string[];
}

const HTML_BYTES_TOLERANCE = 0.05;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseManifest(raw: string, label: string): CloneManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${label}: invalid JSON. ${message}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`${label}: top-level must be an object`);
  }
  return {
    viewport: readString(parsed.viewport),
    htmlBytes: readNumber(parsed.htmlBytes),
    styles: readNumber(parsed.styles),
    scripts: readNumber(parsed.scripts),
    assets: readNumber(parsed.assets),
    unresolvedExternal: readNumber(parsed.unresolvedExternal),
    documentUrl: readString(parsed.documentUrl),
  };
}

function compareCount(
  field: string,
  expected: number | undefined,
  actual: number | undefined,
  diagnostics: string[],
): boolean {
  if (expected === undefined || actual === undefined) {
    diagnostics.push(
      `${field}: expected or actual missing (expected=${String(expected)} actual=${String(actual)})`,
    );
    return false;
  }
  if (expected !== actual) {
    diagnostics.push(`${field}: expected ${expected}, got ${actual}`);
    return false;
  }
  return true;
}

function compareHtmlBytes(
  expected: number | undefined,
  actual: number | undefined,
  diagnostics: string[],
): boolean {
  if (expected === undefined || actual === undefined) {
    diagnostics.push(
      `htmlBytes: expected or actual missing (expected=${String(expected)} actual=${String(actual)})`,
    );
    return false;
  }
  if (expected === 0) {
    if (actual === 0) return true;
    diagnostics.push(`htmlBytes: expected 0, got ${actual}`);
    return false;
  }
  const drift = Math.abs(actual - expected) / expected;
  if (drift > HTML_BYTES_TOLERANCE) {
    diagnostics.push(
      `htmlBytes: drift ${(drift * 100).toFixed(2)}% exceeds tolerance ${HTML_BYTES_TOLERANCE * 100}% (expected ${expected}, got ${actual})`,
    );
    return false;
  }
  return true;
}

export interface CompareInput {
  readonly slug: string;
  readonly fixtureDir: string;
  readonly captureRef: string;
  readonly repoRoot: string;
  readonly parityThreshold: number;
  readonly expectedViewport?: string;
}

export async function compareManifestShape(
  input: CompareInput,
): Promise<ComparisonResult> {
  const expectedPath = join(
    input.fixtureDir,
    "expected",
    "clone-manifest.json",
  );
  const livePath = resolve(input.repoRoot, input.captureRef, "manifest.json");

  let expectedRaw: string;
  try {
    expectedRaw = await readFile(expectedPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      passed: false,
      score: 0,
      summary: "expected/clone-manifest.json not readable",
      diagnostics: [message],
    };
  }

  let liveRaw: string;
  try {
    liveRaw = await readFile(livePath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      passed: false,
      score: 0,
      summary: `capture-ref manifest.json missing at ${livePath}`,
      diagnostics: [message],
    };
  }

  const expected = parseManifest(expectedRaw, "expected/clone-manifest.json");
  const live = parseManifest(liveRaw, livePath);

  const diagnostics: string[] = [];
  const checks = [
    compareCount("styles", expected.styles, live.styles, diagnostics),
    compareCount("scripts", expected.scripts, live.scripts, diagnostics),
    compareCount("assets", expected.assets, live.assets, diagnostics),
    compareCount(
      "unresolvedExternal",
      expected.unresolvedExternal,
      live.unresolvedExternal,
      diagnostics,
    ),
    compareHtmlBytes(expected.htmlBytes, live.htmlBytes, diagnostics),
  ];

  if (expected.documentUrl && expected.documentUrl !== live.documentUrl) {
    diagnostics.push(
      `documentUrl: expected ${expected.documentUrl}, got ${live.documentUrl ?? "missing"}`,
    );
    checks.push(false);
  }

  if (input.expectedViewport && live.viewport && live.viewport !== input.expectedViewport) {
    diagnostics.push(
      `viewport: fixture declares ${input.expectedViewport}, live manifest reports ${live.viewport}`,
    );
    checks.push(false);
  }

  const passedCount = checks.filter((c) => c).length;
  const totalCount = checks.length;
  const score = totalCount === 0 ? 0 : passedCount / totalCount;
  const passed = score >= input.parityThreshold && diagnostics.length === 0;

  return {
    passed,
    score,
    summary: passed
      ? `manifest-shape match (${passedCount}/${totalCount})`
      : `manifest-shape diff (${passedCount}/${totalCount} checks passed)`,
    diagnostics,
  };
}
