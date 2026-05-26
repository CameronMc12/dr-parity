/**
 * Coverage tracker. Every request the backend sees is logged with its method,
 * path, the matched handler (or null), and whether it was served LIVE or counted
 * as a MISS. The coverage harness reads this to compute "% backend".
 *
 * A MISS is any internal API request with no handler — the server still returns
 * an empty-200 (so the bundle does not break) but the path is recorded as a gap
 * to implement next. Static asset and navigation requests are not counted.
 */

export type CoverageOutcome = 'live' | 'miss';

export type CoverageEntry = {
  method: string;
  path: string;
  handler: string | null;
  outcome: CoverageOutcome;
};

export class CoverageLog {
  private readonly entries: CoverageEntry[] = [];
  private readonly missByPath = new Map<string, number>();
  private readonly liveByHandler = new Map<string, number>();

  record(entry: CoverageEntry): void {
    this.entries.push(entry);
    if (entry.outcome === 'miss') {
      const key = templatizePath(entry.path);
      this.missByPath.set(key, (this.missByPath.get(key) ?? 0) + 1);
    } else if (entry.handler) {
      this.liveByHandler.set(entry.handler, (this.liveByHandler.get(entry.handler) ?? 0) + 1);
    }
  }

  summary(): {
    total: number;
    live: number;
    miss: number;
    topMiss: { path: string; count: number }[];
    liveHandlers: { handler: string; count: number }[];
  } {
    const live = this.entries.filter((e) => e.outcome === 'live').length;
    const miss = this.entries.length - live;
    const topMiss = Array.from(this.missByPath.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count);
    const liveHandlers = Array.from(this.liveByHandler.entries())
      .map(([handler, count]) => ({ handler, count }))
      .sort((a, b) => b.count - a.count);
    return { total: this.entries.length, live, miss, topMiss, liveHandlers };
  }

  reset(): void {
    this.entries.length = 0;
    this.missByPath.clear();
    this.liveByHandler.clear();
  }
}

/** Collapse numeric / long-hex id segments to '*' so miss counts group sanely. */
export function templatizePath(path: string): string {
  const [pathname] = path.split('?');
  return pathname
    .split('/')
    .map((seg) => (/^[0-9]+$|^[0-9a-f]{8,}$/i.test(seg) ? '*' : seg))
    .join('/');
}
