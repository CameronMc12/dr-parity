/**
 * Status + priority + grouping helpers shared by the cell editors and the
 * grouping engine. The status set for a given list is derived from the tasks
 * present (so AB Content keeps drafting/running/analyzing while Project 1 keeps
 * the default to-do/in-progress/complete set), bucketed into ClickUp's
 * "Not started / Active / Closed" sections.
 */

import { statusOrder } from '@/data/status-order';
import type { Task } from '@/store/workspace/types';

export interface StatusOption {
  status: string;
  statusColor: string;
  statusType: string;
}

export interface StatusGroup {
  heading: 'Not started' | 'Active' | 'Closed';
  options: StatusOption[];
}

const TERMINAL = new Set(['done', 'closed']);

/** Default ClickUp status set when a list has no tasks to infer from. */
const DEFAULT_STATUSES: StatusOption[] = [
  { status: 'to do', statusColor: '#87909e', statusType: 'open' },
  { status: 'in progress', statusColor: '#3db8f5', statusType: 'custom' },
  { status: 'complete', statusColor: '#6bc950', statusType: 'closed' },
];

/** Distinct status options present on a list, ordered by ClickUp orderindex. */
export function listStatusOptions(tasks: Task[]): StatusOption[] {
  if (tasks.length === 0) return DEFAULT_STATUSES;
  const seen = new Map<string, StatusOption>();
  for (const t of tasks) {
    if (!seen.has(t.status)) {
      seen.set(t.status, {
        status: t.status,
        statusColor: t.statusColor || '#87909e',
        statusType: t.statusType || 'open',
      });
    }
  }
  // Ensure a closed bucket exists so "Closed → Complete" is always pickable.
  if (![...seen.values()].some((o) => TERMINAL.has(o.statusType))) {
    seen.set('complete', { status: 'complete', statusColor: '#6bc950', statusType: 'closed' });
  }
  return [...seen.values()].sort(
    (a, b) => statusOrder(a.status) - statusOrder(b.status),
  );
}

/** Bucket the status options into the three labelled sections. */
export function groupStatusOptions(options: StatusOption[]): StatusGroup[] {
  const notStarted: StatusOption[] = [];
  const active: StatusOption[] = [];
  const closed: StatusOption[] = [];
  for (const o of options) {
    if (TERMINAL.has(o.statusType)) closed.push(o);
    else if (statusOrder(o.status) === 0) notStarted.push(o);
    else active.push(o);
  }
  const groups: StatusGroup[] = [];
  if (notStarted.length) groups.push({ heading: 'Not started', options: notStarted });
  if (active.length) groups.push({ heading: 'Active', options: active });
  if (closed.length) groups.push({ heading: 'Closed', options: closed });
  return groups;
}

// ── Priority ────────────────────────────────────────────────────────────────

export interface PriorityOption {
  key: string;
  label: string;
  color: string;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { key: 'urgent', label: 'Urgent', color: '#e23f29' },
  { key: 'high', label: 'High', color: '#f8ae00' },
  { key: 'normal', label: 'Normal', color: '#6395fa' },
  { key: 'low', label: 'Low', color: '#d8d8d8' },
];

export function priorityLabel(key: string): string {
  return PRIORITY_OPTIONS.find((p) => p.key === key)?.label ?? key;
}
