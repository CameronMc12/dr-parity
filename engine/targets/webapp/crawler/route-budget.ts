/**
 * Per-route interaction budget. Tracks clicks/right-clicks against each
 * routePath (URL pathname, ignoring query + hash). Prevents the crawler from
 * burning the entire session inside a single state (e.g. cycling drafts).
 */
export type BudgetLogger = (routePath: string, limit: number) => void;

export function createRouteBudget(limit: number, onExhausted: BudgetLogger) {
  const counts = new Map<string, number>();
  const loggedExhausted = new Set<string>();

  return {
    bump(routePath: string): number {
      const next = (counts.get(routePath) ?? 0) + 1;
      counts.set(routePath, next);
      return next;
    },
    isExhausted(routePath: string): boolean {
      return (counts.get(routePath) ?? 0) >= limit;
    },
    logIfFirstHit(routePath: string): void {
      if (loggedExhausted.has(routePath)) return;
      loggedExhausted.add(routePath);
      onExhausted(routePath, limit);
    },
    get(routePath: string): number {
      return counts.get(routePath) ?? 0;
    },
  };
}

export type RouteBudget = ReturnType<typeof createRouteBudget>;
