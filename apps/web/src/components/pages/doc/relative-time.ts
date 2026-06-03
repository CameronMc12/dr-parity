/**
 * Human "Last updated <relative>" string for the doc author row, anchored to
 * ANCHOR_NOW (the workspace's fixed "now") so the clone is deterministic and
 * never drifts with the wall clock. Mirrors ClickUp's coarse buckets
 * (just now / N minutes / N hours / yesterday / N days / on <date>).
 */

import { ANCHOR_NOW, DAY_MS } from '@/lib/view-data';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export function relativeUpdated(epoch: number | null): string {
  if (epoch == null) return 'just now';
  const delta = ANCHOR_NOW - epoch;
  if (delta < MINUTE_MS) return 'just now';
  if (delta < HOUR_MS) {
    const m = Math.round(delta / MINUTE_MS);
    return `${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (delta < DAY_MS) {
    const h = Math.round(delta / HOUR_MS);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(delta / DAY_MS);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `on ${formatDate(epoch)}`;
}

function formatDate(epoch: number): string {
  return new Date(epoch).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * ClickUp's doc author-row timestamp: "Today at 9:51 am" / "Yesterday at 4:02 pm"
 * / "May 14 at 9:51 am". Day bucket is computed against ANCHOR_NOW's calendar
 * day so the offline clone stays deterministic.
 */
export function clockUpdated(epoch: number | null): string {
  if (epoch == null) return 'Today';
  const day = dayBucket(epoch);
  return `${day} at ${formatTime(epoch)}`;
}

function dayBucket(epoch: number): string {
  const now = new Date(ANCHOR_NOW);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const deltaDays = Math.floor((startOfToday - epoch) / DAY_MS);
  if (epoch >= startOfToday) return 'Today';
  if (deltaDays < 1) return 'Yesterday';
  return formatDate(epoch);
}

function formatTime(epoch: number): string {
  return new Date(epoch)
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();
}
