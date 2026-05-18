#!/usr/bin/env tsx
/**
 * Backward-compatible thin shim around the unified multi-target CLI in
 * `scripts/build.ts`. Hardcodes `--target=astro` so existing call sites and
 * the `npm run build-astro` entry keep working.
 *
 * Usage (unchanged):
 *   tsx scripts/build-astro.ts <clone-dir> [--out=<dir>] [--name=<slug>] [--force]
 *   tsx scripts/build-astro.ts --help
 *
 * New work should call `tsx scripts/build.ts --target=astro` directly.
 */

import { runBuild } from './build';

runBuild({ argv: process.argv.slice(2), forcedTarget: 'astro' });
