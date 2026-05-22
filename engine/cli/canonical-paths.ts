/**
 * Canonical output convention for Dr Parity V2.0.
 *
 * Source of truth: docs/V2.0/01-pipeline-audit.md Part C section C.1
 * (referenced from docs/V2.0/05-action-plan.md §2 locked decision 7).
 *
 * Layout:
 *   clones/<target>/<iso-timestamp>/
 *     manifest.json
 *     logs/
 *     captures/<viewport>/
 *     parsed/<viewport>/
 *     clones/<viewport>/
 *     crawl/              (only present for multi-page crawl runs)
 *     audit/              (only present for webapp audit runs)
 *     sites/<target>/     (only present once an emitted project lands)
 *     reports/{qa,parity,animations}/
 *
 * This module exports pure path helpers only. Directory creation is the
 * caller's responsibility (Phase 5 will own the writer).
 */

import { posix } from "node:path";

export const CANONICAL_ROOT = "clones";

export const CANONICAL_SUBDIRS = {
  logs: "logs",
  captures: "captures",
  parsed: "parsed",
  clones: "clones",
  crawl: "crawl",
  audit: "audit",
  sites: "sites",
  reports: "reports",
} as const;

export type CanonicalSubdir = keyof typeof CANONICAL_SUBDIRS;

/**
 * Replace colons and dots with dashes so the timestamp is safe on every
 * filesystem we target. Output: `2026-05-22T14-30-00-123Z`.
 */
export function canonicalTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

/**
 * Derive a default target name from a URL host.
 *
 *   https://stripe.com           -> stripe
 *   https://app.linear.app       -> linear-app
 *   https://omnisocials.com/en   -> omnisocials
 *
 * Drops the TLD, joins remaining labels with dashes, lowercases.
 */
export function defaultTargetFromHost(host: string): string {
  const labels = host.toLowerCase().split(".").filter(Boolean);
  if (labels.length === 0) return "unknown";
  if (labels.length === 1) return labels[0];
  // Drop the TLD (last label).
  return labels.slice(0, -1).join("-");
}

/**
 * Root directory for a single clone run.
 * Example: `clones/stripe/2026-05-22T14-30-00-000Z`.
 */
export function cloneOutDir(
  target: string,
  isoTimestamp: string,
  baseDir: string = CANONICAL_ROOT,
): string {
  return posix.join(baseDir, target, isoTimestamp);
}

/** Subdirectory under a clone root. */
export function cloneSubdir(
  target: string,
  isoTimestamp: string,
  subdir: CanonicalSubdir,
  baseDir: string = CANONICAL_ROOT,
): string {
  return posix.join(cloneOutDir(target, isoTimestamp, baseDir), subdir);
}

/** Per-viewport directory under one of the viewport-scoped subdirs. */
export function viewportDir(
  target: string,
  isoTimestamp: string,
  subdir: "captures" | "parsed" | "clones",
  viewport: string,
  baseDir: string = CANONICAL_ROOT,
): string {
  return posix.join(
    cloneSubdir(target, isoTimestamp, subdir, baseDir),
    viewport,
  );
}

/** Per-framework emitted project directory under `sites/`. */
export function siteDir(
  target: string,
  isoTimestamp: string,
  framework: "astro" | "react" | "webapp" | "html-mirror",
  baseDir: string = CANONICAL_ROOT,
): string {
  return posix.join(
    cloneSubdir(target, isoTimestamp, "sites", baseDir),
    framework,
  );
}
