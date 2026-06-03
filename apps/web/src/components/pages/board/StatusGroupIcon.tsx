/**
 * The colored status indicator glyph rendered to the left of a board-group label
 * (ClickUp `cu-status-group-indicator`). The glyph shape is driven by the group's
 * status *type*, not its label, so it matches ClickUp's status-category icons:
 *
 *   - `open`  / "to do"   → segmented (dashed) ring
 *   - active  / custom    → progress arc (open ring with a quarter filled)
 *   - `done`  / `closed`  → solid filled circle with a check
 *
 * Color is the group's status color (already mapped to our dark tokens upstream).
 */

export type StatusGroupKind = 'open' | 'active' | 'done';

/**
 * Map a raw `statusType` (+ optional label fallback) to one of the three glyph
 * kinds. Empty derived columns carry no task, so the label heuristic covers
 * "complete"/"closed"/"done" → done and "to do"/"open"/"backlog" → open.
 */
export function statusGroupKind(statusType: string, label: string): StatusGroupKind {
  const t = statusType.toLowerCase();
  if (t === 'done' || t === 'closed') return 'done';
  if (t === 'open') return 'open';

  const l = label.toLowerCase();
  if (/(complete|closed|done|pass|deployed)/.test(l)) return 'done';
  if (/(to do|todo|open|backlog|new)/.test(l)) return 'open';
  return 'active';
}

export function StatusGroupIcon({
  kind,
  color,
  size = 16,
}: {
  kind: StatusGroupKind;
  color: string;
  size?: number;
}) {
  if (kind === 'done') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill={color} />
        <path
          d="M8 12.4l2.6 2.6L16.2 9"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === 'open') {
    // Segmented / dashed ring — ClickUp's "not started" indicator.
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="8.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="2.6 3.2"
        />
      </svg>
    );
  }

  // Active / in-progress — ring with a quarter-turn progress arc filled.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="2" opacity={0.35} />
      <path
        d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
