/**
 * Default webapp profile.
 *
 * Empty/null profile. `discoverers` is an empty array, so the crawler's
 * behaviour is byte-identical to before profiles existed. The host matcher
 * `/.*\/` is the universal fallback; resolution treats `default` as the last
 * candidate regardless, but the matcher is kept consistent.
 */

import type { WebappProfile } from './types';

export const defaultProfile: WebappProfile = {
  name: 'default',
  hostMatchers: [/.*/],
  discoverers: [],
};
