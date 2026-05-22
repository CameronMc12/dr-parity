/**
 * Animations pass for the capture pipeline.
 *
 * Wraps the three calls needed to produce `animations.json` for one viewport:
 *   1. inject runtime shims (must happen BEFORE the first page.goto)
 *   2. run static plus runtime plus active-probe detection
 *   3. collect any document.startViewTransition() invocations and CSS rules
 *
 * Designed so scripts/capture.ts stays a thin CLI orchestrator. The
 * Playwright HAR plus trace recording does not carry timing, easing, or
 * view-transition data; this pass is the only home for that information
 * after the V2.0 legacy extract chain is retired.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, BrowserContext } from "playwright";
import {
  injectAnimationMonitors,
  injectAnimationMonitorsOnContext,
  detectAnimations,
  collectViewTransitions,
  type AnimationDetectionResult,
  type DetectionOptions,
} from "./animation-monitor";
import type { ViewTransitionRecord } from "../../types/extraction";

/**
 * Combined per-viewport animations record written to `animations.json`.
 *
 * Kept intentionally permissive: any future detector layers (e.g. layout
 * shift observers) can extend this without breaking callers.
 */
export interface AnimationsCaptureRecord {
  /** ISO timestamp of when detection finished. */
  capturedAt: string;
  /** Detection wall time, in milliseconds. */
  detectionDuration: number;
  /** Output of detectAnimations(). */
  detection: AnimationDetectionResult;
  /** Output of collectViewTransitions(). May be empty. */
  viewTransitions: ViewTransitionRecord[];
}

export interface AnimationsPassOptions extends DetectionOptions {
  /** Output directory for the viewport. `animations.json` lands here. */
  outDir: string;
  /** Optional label used in console logs (typically the viewport name). */
  label?: string;
}

/**
 * Install the runtime monitor on a context. MUST be called before any
 * page.goto so the shims run before the page's own scripts. The script
 * sticks to every page the context spawns afterwards.
 */
export async function installAnimationMonitor(
  ctx: BrowserContext,
): Promise<void> {
  await injectAnimationMonitorsOnContext(ctx);
}

/**
 * Page-level installer for callers without a clean context (e.g. CDP
 * attach mode where the existing context belongs to the user's profile
 * and addInitScript may have already missed the bus for the first page).
 * Call this BEFORE the page navigates; init scripts only run from the
 * next document load forward.
 */
export async function installAnimationMonitorOnPage(page: Page): Promise<void> {
  await injectAnimationMonitors(page);
}

/**
 * Run detection plus view-transition collection on an already-navigated
 * page, then write `animations.json` into `outDir`. Returns the captured
 * record so callers can decide whether to log a one-line summary.
 *
 * Failures are converted to a sentinel record with `detection.totalDetected`
 * = 0; we never let an animation collection error kill the capture run.
 */
export async function runAnimationsPass(
  page: Page,
  options: AnimationsPassOptions,
): Promise<AnimationsCaptureRecord> {
  const { outDir, label, ...detectionOptions } = options;
  const startedAt = Date.now();

  try {
    const detection = await detectAnimations(page, detectionOptions);
    const viewTransitions = await collectViewTransitions(page);
    const record: AnimationsCaptureRecord = {
      capturedAt: new Date().toISOString(),
      detectionDuration: Date.now() - startedAt,
      detection,
      viewTransitions,
    };
    writeFileSync(join(outDir, "animations.json"), JSON.stringify(record, null, 2));
    const tag = label ? `${label}: ` : "";
    console.log(
      `  [animations] ${tag}${detection.totalDetected} animations, ` +
        `${viewTransitions.length} view transitions, ` +
        `${detection.libraries.length} libraries, ` +
        `${detection.detectionDuration}ms`,
    );
    return record;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallback: AnimationsCaptureRecord = {
      capturedAt: new Date().toISOString(),
      detectionDuration: Date.now() - startedAt,
      detection: {
        animations: [],
        libraries: [],
        globalScrollBehavior: "native",
        staggerPatterns: [],
        videoScrollSyncs: [],
        totalDetected: 0,
        detectionDuration: 0,
      },
      viewTransitions: [],
    };
    writeFileSync(
      join(outDir, "animations.json"),
      JSON.stringify({ ...fallback, error: message }, null, 2),
    );
    const tag = label ? `${label}: ` : "";
    console.warn(`  [animations] ${tag}capture failed: ${message}`);
    return fallback;
  }
}
