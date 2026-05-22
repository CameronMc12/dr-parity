/**
 * `parity test` runner.
 *
 * Phase 3d / W2C per docs/V2.0/05-action-plan.md section 3.
 *
 * Walks `tests/fixtures/sites/`, compares each fixture against its
 * locked baseline, and reports pass or fail per fixture plus a summary
 * line. Exits non-zero if any fixture regresses.
 *
 * Implemented as a Stage<void, RegressionReport> so it can plug into the
 * orchestrator in engine/cli/orchestrate.ts when Phase 5 wires the full
 * .runs/ lifecycle. For now it can also be called standalone via the
 * citty handler in bin/parity.ts.
 */

import { resolve } from "node:path";
import { ok, type Stage, type StageResult } from "../stage.js";
import { compareManifestShape, type ComparisonResult } from "./manifest-shape.js";
import { compareRebuildPixelDiff } from "./rebuild-pixel-diff.js";
import { loadFixtures, type Fixture } from "./fixture-schema.js";

export interface FixtureOutcome {
  readonly slug: string;
  readonly target: Fixture["target"];
  readonly viewport: Fixture["viewport"];
  readonly threshold: number;
  readonly mode: Fixture["comparisonMode"];
  readonly passed: boolean;
  readonly score: number;
  readonly summary: string;
  readonly diagnostics: readonly string[];
  readonly skipped: boolean;
  readonly skipReason?: string;
}

export interface RegressionReport {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly outcomes: readonly FixtureOutcome[];
}

export interface RegressionTestInput {
  readonly repoRoot: string;
}

function unsupportedMode(mode: Fixture["comparisonMode"]): FixtureOutcome {
  return {
    slug: "",
    target: "astro",
    viewport: "desktop",
    threshold: 0,
    mode,
    passed: false,
    score: 0,
    summary: `comparison_mode "${mode}" not yet implemented`,
    diagnostics: [],
    skipped: true,
    skipReason: `comparison_mode "${mode}" is not wired into the runner. Supported: manifest-shape, rebuild-pixel-diff.`,
  };
}

async function evaluateFixture(
  fixture: Fixture,
  repoRoot: string,
): Promise<FixtureOutcome> {
  if (
    fixture.comparisonMode !== "manifest-shape" &&
    fixture.comparisonMode !== "rebuild-pixel-diff"
  ) {
    return {
      ...unsupportedMode(fixture.comparisonMode),
      slug: fixture.slug,
      target: fixture.target,
      viewport: fixture.viewport,
      threshold: fixture.parityThreshold,
    };
  }

  if (fixture.captureRef.length === 0) {
    return {
      slug: fixture.slug,
      target: fixture.target,
      viewport: fixture.viewport,
      threshold: fixture.parityThreshold,
      mode: fixture.comparisonMode,
      passed: false,
      score: 0,
      summary: "capture-ref/source.txt missing or empty",
      diagnostics: [],
      skipped: false,
    };
  }

  let result: ComparisonResult;
  if (fixture.comparisonMode === "rebuild-pixel-diff") {
    result = await compareRebuildPixelDiff({
      fixture,
      repoRoot,
    });
  } else {
    result = await compareManifestShape({
      slug: fixture.slug,
      fixtureDir: fixture.dir,
      captureRef: fixture.captureRef,
      repoRoot,
      parityThreshold: fixture.parityThreshold,
      expectedViewport: fixture.viewport,
    });
  }

  return {
    slug: fixture.slug,
    target: fixture.target,
    viewport: fixture.viewport,
    threshold: fixture.parityThreshold,
    mode: fixture.comparisonMode,
    passed: result.passed,
    score: result.score,
    summary: result.summary,
    diagnostics: result.diagnostics,
    skipped: false,
  };
}

export const regressionTestStage: Stage<RegressionTestInput, RegressionReport> =
  {
    name: "parity-test",
    async run(input): Promise<StageResult<RegressionReport>> {
      const fixtures = await loadFixtures(input.repoRoot);
      const outcomes: FixtureOutcome[] = [];
      for (const fixture of fixtures) {
        const outcome = await evaluateFixture(fixture, input.repoRoot);
        outcomes.push(outcome);
      }

      const passed = outcomes.filter((o) => o.passed).length;
      const skipped = outcomes.filter((o) => o.skipped).length;
      const failed = outcomes.length - passed - skipped;

      const report: RegressionReport = {
        total: outcomes.length,
        passed,
        failed,
        skipped,
        outcomes,
      };

      return ok(report, {
        fixtures: outcomes.length,
        passed,
        failed,
        skipped,
      });
    },
  };

/**
 * Standalone runner. Returns the exit code the CLI should propagate.
 * Writes one line per fixture plus a summary line to stdout.
 */
export async function runRegressionTest(repoRoot?: string): Promise<number> {
  const root = resolve(repoRoot ?? process.cwd());
  const fixtures = await loadFixtures(root);

  if (fixtures.length === 0) {
    process.stdout.write(
      "parity test: no fixtures found under tests/fixtures/sites/\n",
    );
    return 0;
  }

  let failed = 0;
  let passed = 0;
  let skipped = 0;

  for (const fixture of fixtures) {
    const outcome = await evaluateFixture(fixture, root);
    const status = outcome.skipped
      ? "SKIP"
      : outcome.passed
        ? "PASS"
        : "FAIL";
    const scoreLabel = outcome.skipped
      ? "n/a"
      : `${(outcome.score * 100).toFixed(1)}%`;
    process.stdout.write(
      `${status} ${outcome.slug.padEnd(24)} target=${outcome.target.padEnd(7)} viewport=${outcome.viewport.padEnd(7)} score=${scoreLabel.padStart(6)} threshold=${(outcome.threshold * 100).toFixed(1)}% ${outcome.summary}\n`,
    );
    if (outcome.diagnostics.length > 0) {
      for (const line of outcome.diagnostics) {
        process.stdout.write(`     ${line}\n`);
      }
    }
    if (outcome.skipped) {
      skipped += 1;
      if (outcome.skipReason) {
        process.stdout.write(`     reason: ${outcome.skipReason}\n`);
      }
    } else if (outcome.passed) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  process.stdout.write(
    `\nparity test summary: ${passed} passed, ${failed} failed, ${skipped} skipped, ${fixtures.length} total\n`,
  );

  return failed === 0 ? 0 : 1;
}
