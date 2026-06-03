/**
 * Month-grid + quick-date helpers for the due-date editor. Pure date math, no
 * UI. Weeks start on Sunday to match the oracle (Su Mo Tu We Th Fr Sa).
 */

export interface DayCell {
  date: number; // epoch ms at local midnight
  day: number; // 1-31
  inMonth: boolean;
  isToday: boolean;
}

const DAY_MS = 86_400_000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** 6-week grid (42 cells) for the given month, padded with neighbouring days. */
export function monthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);
  const today = startOfDay(Date.now());
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    );
    cells.push({
      date: d.getTime(),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: d.getTime() === today,
    });
  }
  return cells;
}

export interface QuickDate {
  label: string;
  hint: string;
  value: number;
}

/** ClickUp's quick-pick due dates relative to now. */
export function quickDates(now = Date.now()): QuickDate[] {
  const today = startOfDay(now);
  const dow = new Date(today).getDay(); // 0 Sun .. 6 Sat
  const sat = today + ((6 - dow + 7) % 7) * DAY_MS;
  const nextWeekStart = today + (8 - (dow === 0 ? 7 : dow)) * DAY_MS; // next Monday
  const nextSat = sat + 7 * DAY_MS;
  const fmt = (ts: number) =>
    new Date(ts).toLocaleString('en-US', { day: 'numeric', month: 'short' });
  const wd = (ts: number) =>
    new Date(ts).toLocaleString('en-US', { weekday: 'short' });
  return [
    { label: 'Today', hint: wd(today), value: today },
    { label: 'Tomorrow', hint: wd(today + DAY_MS), value: today + DAY_MS },
    { label: 'This weekend', hint: wd(sat), value: sat },
    { label: 'Next week', hint: fmt(nextWeekStart), value: nextWeekStart },
    { label: 'Next weekend', hint: fmt(nextSat), value: nextSat },
    { label: '2 weeks', hint: fmt(today + 14 * DAY_MS), value: today + 14 * DAY_MS },
    { label: '4 weeks', hint: fmt(today + 28 * DAY_MS), value: today + 28 * DAY_MS },
  ];
}

export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
