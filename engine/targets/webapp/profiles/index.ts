/**
 * Webapp profiles barrel.
 *
 * Single import surface for callers (CLI, crawler init). Re-exports the
 * resolver + the profile type, plus the named profiles for direct use in
 * tests.
 */

export { defaultProfile } from './default';
export { clickupProfile } from './clickup';
export { listProfileNames, resolveProfile } from './resolve-profile';
export type { WebappProfile } from './types';
