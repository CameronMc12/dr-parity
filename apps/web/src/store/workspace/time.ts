/**
 * Time formatting + parsing helpers shared by the task panel's Time Estimate
 * and Track Time fields. Estimates are stored in minutes; tracked time in ms.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** Parse a human estimate like "2h 30m", "90m", "1.5h", "45" (→ minutes). */
export function parseEstimate(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  let minutes = 0;
  let matched = false;

  const hours = text.match(/([\d.]+)\s*h/);
  if (hours?.[1]) {
    minutes += Math.round(parseFloat(hours[1]) * 60);
    matched = true;
  }
  const mins = text.match(/([\d.]+)\s*m/);
  if (mins?.[1]) {
    minutes += Math.round(parseFloat(mins[1]));
    matched = true;
  }
  if (!matched) {
    const bare = parseFloat(text);
    if (Number.isNaN(bare)) return null;
    minutes = Math.round(bare);
  }
  return minutes > 0 ? minutes : null;
}

/** Format a minute count as a compact estimate label, e.g. 150 → "2h 30m". */
export function fmtEstimate(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Format a millisecond span as "1h 02m 05s" / "02m 05s" / "05s". */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m) return `${pad(m)}m ${pad(s)}s`;
  return `${s}s`;
}

/** Sum a task's tracked-time entries in ms. */
export function totalTracked(entries: { durationMs: number }[] | undefined): number {
  return (entries ?? []).reduce((sum, e) => sum + e.durationMs, 0);
}

export { MIN, HOUR };
