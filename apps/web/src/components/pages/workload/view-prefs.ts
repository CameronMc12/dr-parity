/**
 * Per-view persistence for the Workload toolbar config (metric, range, schedule,
 * backlog, zoom, capacity/empty toggles). ClickUp's "Save view" writes the
 * current control state so it survives reloads; "Reset to default" clears it.
 *
 * Stored in `localStorage` under a per-viewId key. Pure read/write helpers — no
 * React. Guarded for SSR (no `window`) and malformed payloads.
 */

import type { ScheduleMode } from './periods';
import type { WorkloadMetric, WorkloadRangeDays } from './tokens';

const STORAGE_PREFIX = 'cu:workload:prefs:';

/** The persisted slice of Workload toolbar state. */
export interface WorkloadPrefs {
  metric: WorkloadMetric;
  range: WorkloadRangeDays;
  schedule: ScheduleMode;
  backlog: boolean;
  showEmpty: boolean;
  capacityOn: boolean;
  zoom: number;
}

const METRICS: WorkloadMetric[] = ['time', 'tasks', 'points'];
const RANGES: WorkloadRangeDays[] = [7, 14, 28];
const SCHEDULES: ScheduleMode[] = ['Daily Scheduled', 'Total Scheduled'];

function keyFor(viewId: string): string {
  return `${STORAGE_PREFIX}${viewId}`;
}

/** Read saved prefs for a view, or `null` when absent / invalid / SSR. */
export function loadWorkloadPrefs(viewId: string): WorkloadPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(viewId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkloadPrefs>;
    if (
      !METRICS.includes(parsed.metric as WorkloadMetric) ||
      !RANGES.includes(parsed.range as WorkloadRangeDays) ||
      !SCHEDULES.includes(parsed.schedule as ScheduleMode) ||
      typeof parsed.backlog !== 'boolean' ||
      typeof parsed.showEmpty !== 'boolean' ||
      typeof parsed.capacityOn !== 'boolean' ||
      typeof parsed.zoom !== 'number'
    ) {
      return null;
    }
    return {
      metric: parsed.metric as WorkloadMetric,
      range: parsed.range as WorkloadRangeDays,
      schedule: parsed.schedule as ScheduleMode,
      backlog: parsed.backlog,
      showEmpty: parsed.showEmpty,
      capacityOn: parsed.capacityOn,
      zoom: parsed.zoom,
    };
  } catch {
    return null;
  }
}

/** Persist prefs for a view. Optionally under an alternate id ("Save as new"). */
export function saveWorkloadPrefs(viewId: string, prefs: WorkloadPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyFor(viewId), JSON.stringify(prefs));
  } catch {
    /* storage unavailable / quota — non-fatal for an in-session view */
  }
}

/** Clear saved prefs for a view ("Reset to default"). */
export function clearWorkloadPrefs(viewId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(viewId));
  } catch {
    /* non-fatal */
  }
}
