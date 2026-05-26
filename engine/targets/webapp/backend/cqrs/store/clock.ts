// Deterministic time + id generation. NO Date.now() / Math.random() at runtime.
// Same seed + same call order => identical timestamps and ids. This is what makes
// append + replay reproducible.

export interface Clock {
  /** Monotonic ISO-8601 timestamp. Each call advances by a fixed tick. */
  now(): string;
}

export interface IdGen {
  /** Deterministic, monotonic id with the given prefix (e.g. "evt", "task"). */
  next(prefix: string): string;
}

const DEFAULT_EPOCH_MS = Date.parse("2025-01-01T00:00:00.000Z");
const DEFAULT_TICK_MS = 1000;

export class DeterministicClock implements Clock {
  private current: number;
  private readonly tick: number;

  constructor(epochMs: number = DEFAULT_EPOCH_MS, tickMs: number = DEFAULT_TICK_MS) {
    this.current = epochMs;
    this.tick = tickMs;
  }

  now(): string {
    const iso = new Date(this.current).toISOString();
    this.current += this.tick;
    return iso;
  }
}

export class DeterministicIdGen implements IdGen {
  private readonly counters = new Map<string, number>();

  next(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}_${String(n).padStart(8, "0")}`;
  }

  /**
   * Advance a prefix's counter to at least `count` so the next id continues past
   * already-persisted ids. Used when a fresh generator attaches to an existing
   * event store: priming "evt" to the current event count avoids id collisions
   * while staying deterministic for the new run.
   */
  primeTo(prefix: string, count: number): void {
    const current = this.counters.get(prefix) ?? 0;
    if (count > current) this.counters.set(prefix, count);
  }
}
