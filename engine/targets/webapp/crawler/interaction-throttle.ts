/**
 * Inter-interaction throttle for the extended interaction harnesses (L4 hover,
 * L5 keyboard / command-palette / slash-menu, DnD). Cameron wants a configurable
 * delay between fired interactions to stay under ClickUp's rate limits.
 *
 * Resolution order (first hit wins):
 *   1. explicit `overrideMs` argument
 *   2. DRPARITY_INTERACTION_DELAY_MS env var
 *   3. a random jitter inside [MIN_DELAY_MS, MAX_DELAY_MS]
 *
 * The jitter band (rather than a fixed value) spreads the request cadence so the
 * traffic shape looks less machine-regular.
 */

const MIN_DELAY_MS = 400;
const MAX_DELAY_MS = 800;

export type Throttle = {
  /** Resolve the configured delay in ms (no waiting). */
  delayMs(): number;
  /** Wait the configured delay. Never throws. */
  wait(page: { waitForTimeout(ms: number): Promise<void> }): Promise<void>;
};

function resolveDelay(overrideMs?: number): number {
  if (typeof overrideMs === 'number' && overrideMs >= 0) return overrideMs;

  const env = process.env.DRPARITY_INTERACTION_DELAY_MS;
  if (env) {
    const parsed = Number.parseInt(env, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  const span = MAX_DELAY_MS - MIN_DELAY_MS;
  return MIN_DELAY_MS + Math.floor(Math.random() * (span + 1));
}

export function createThrottle(overrideMs?: number): Throttle {
  return {
    delayMs(): number {
      return resolveDelay(overrideMs);
    },
    async wait(page): Promise<void> {
      await page.waitForTimeout(resolveDelay(overrideMs)).catch(() => {});
    },
  };
}
