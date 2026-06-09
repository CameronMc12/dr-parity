/**
 * Minimal min-interval throttle. ClickUp's public API allows ~100 req/min on
 * free tier; we default to a 700ms gap between writes (~85/min) to stay safely
 * under the limit and leave headroom for reads.
 */

export interface ThrottleOptions {
  minIntervalMs: number;
}

export class Throttle {
  private readonly minIntervalMs: number;
  private last = 0;

  constructor(opts: ThrottleOptions) {
    if (!Number.isFinite(opts.minIntervalMs) || opts.minIntervalMs < 0) {
      throw new Error(`Invalid throttle minIntervalMs: ${opts.minIntervalMs}`);
    }
    this.minIntervalMs = opts.minIntervalMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.last;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.last = Date.now();
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
