#!/usr/bin/env tsx
/**
 * CLI entry point for the parity harness.
 *
 * Usage:
 *   npm run parity                        # run all routes, full-page diff
 *   npm run parity -- --route=home        # run a single route
 *   npm run parity -- --shell-only        # mask content area, score shell chrome only
 *   npm run parity -- --update-baseline   # reserved placeholder
 */
import { run } from '../src/harness.js';

const args = process.argv.slice(2);

const routeFlag = args.find(a => a.startsWith('--route='));
const route = routeFlag ? routeFlag.split('=')[1] : undefined;
const updateBaseline = args.includes('--update-baseline');
const shellOnly = args.includes('--shell-only');

run({ route, updateBaseline, shellOnly })
  .then(code => process.exit(code))
  .catch(err => {
    console.error('[parity] unhandled error:', err);
    process.exit(1);
  });
