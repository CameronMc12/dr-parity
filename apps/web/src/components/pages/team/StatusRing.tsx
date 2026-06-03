'use client';

/**
 * Status circle matching the List view lead-rail: filled disc when done,
 * dashed ring when not started ('open'), solid ring while in progress.
 */

import type { Task } from '@/store/workspace/types';

function ring(task: Task): { background: string; border: string } {
  const color = task.statusColor || '#87909e';
  const done = task.statusType === 'closed' || task.statusType === 'done';
  if (done) return { background: color, border: 'none' };
  const notStarted = task.statusType === 'open';
  return {
    background: 'transparent',
    border: `1.5px ${notStarted ? 'dashed' : 'solid'} ${color}`,
  };
}

export function StatusRing({ task, size = 14 }: { task: Task; size?: number }) {
  const r = ring(task);
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: r.background,
        border: r.border,
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    />
  );
}
