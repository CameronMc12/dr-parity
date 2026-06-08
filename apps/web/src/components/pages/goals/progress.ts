import type { Goal, Target } from '@/data/goals-seed';

/** Clamp a number into the 0–100 range. */
function clamp(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}

/** Per-target completion as a 0–100 percentage. */
export function targetPercent(target: Target): number {
  switch (target.type) {
    case 'number':
    case 'currency':
      return target.target <= 0 ? 0 : clamp((target.current / target.target) * 100);
    case 'task':
      return target.total <= 0 ? 0 : clamp((target.completed / target.total) * 100);
    case 'boolean':
      return target.done ? 100 : 0;
  }
}

/** Goal overall progress: the average of its targets' percentages. */
export function goalPercent(goal: Goal): number {
  if (goal.targets.length === 0) return 0;
  const sum = goal.targets.reduce((acc, t) => acc + targetPercent(t), 0);
  return sum / goal.targets.length;
}

/** Short human label for a target's current/target state. */
export function targetValueLabel(target: Target): string {
  switch (target.type) {
    case 'number':
      return `${target.current}${unit(target.unit)} / ${target.target}${unit(target.unit)}`;
    case 'currency':
      return `${money(target.current)} / ${money(target.target)}`;
    case 'task':
      return `${target.completed} / ${target.total} tasks`;
    case 'boolean':
      return target.done ? 'Done' : 'Not done';
  }
}

function unit(u?: string): string {
  if (!u) return '';
  return u === '%' ? '%' : ` ${u}`;
}

function money(value: number): string {
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${value}`;
}
