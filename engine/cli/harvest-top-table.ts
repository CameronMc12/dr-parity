/**
 * Renders the top N findings table for `parity runs harvest` stdout.
 *
 * W5B.1 item 5. Sorted by severity ascending (P1 first) then surface count
 * descending. Returns an empty string when there are no findings so callers
 * can avoid printing a stray blank section.
 *
 * The full ticket files are still written by harvestRuns. The table is a
 * discoverability win on the human terminal.
 */

import type { Finding, FindingSeverity } from "./runs-harvest.js";

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
};

const COLUMNS = [
  { key: "slug", label: "slug", width: 36 },
  { key: "sev", label: "sev", width: 3 },
  { key: "count", label: "count", width: 5 },
  { key: "type", label: "type", width: 18 },
] as const;

function pad(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width);
  return value + " ".repeat(width - value.length);
}

function clampLeft(value: string, width: number): string {
  if (value.length <= width) return value;
  return value.slice(0, Math.max(0, width - 3)) + "...";
}

function borderLine(): string {
  return (
    "+" + COLUMNS.map((c) => "-".repeat(c.width + 2)).join("+") + "+"
  );
}

function row(cells: string[]): string {
  return (
    "| " +
    cells.map((c, i) => pad(c, COLUMNS[i].width)).join(" | ") +
    " |"
  );
}

export function renderTopFindingsTable(
  findings: readonly Finding[],
  topN: number,
): string {
  if (findings.length === 0) return "";

  const sorted = [...findings].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return b.surfaceCount - a.surfaceCount;
  });

  const limit = Math.max(1, topN);
  const top = sorted.slice(0, limit);

  const header = `Top findings (showing top ${top.length} of ${findings.length}):`;

  const lines: string[] = [header];
  lines.push(borderLine());
  lines.push(row(COLUMNS.map((c) => c.label)));
  lines.push(borderLine());
  for (const f of top) {
    lines.push(
      row([
        clampLeft(f.slug, COLUMNS[0].width),
        f.severity,
        String(f.surfaceCount),
        clampLeft(f.type, COLUMNS[3].width),
      ]),
    );
  }
  lines.push(borderLine());
  return lines.join("\n");
}
