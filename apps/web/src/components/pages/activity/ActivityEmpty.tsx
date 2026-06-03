'use client';

/**
 * Activity empty state — a 1:1 structural clone of ClickUp's task-Activity empty
 * view, rendered in our dark tokens. The illustration is the stacked-cards
 * "no-activity" graphic (two overlapping list cards, each with an avatar dot and
 * two text lines, plus an activity-pulse badge in the lower-right). Real copy:
 * "Nothing to see here" / "Looks like you don't have any task activity yet."
 *
 * When the user is searching, the heading/description swap to the no-match
 * wording while the layout and illustration stay identical.
 */

import { ACT } from './tokens';

const HEADING = { default: 'Nothing to see here', search: 'No matching activity' };
const DESC = {
  default: "Looks like you don't have any task activity yet.",
  search: 'No task changes match your search.',
};

/** Stacked-cards activity illustration. 120×120, muted line-art in dark tokens. */
function NoActivityArt() {
  const stroke = ACT.border;
  const fill = 'var(--cu-bg-menu, rgba(255,255,255,0.03))';
  const line = ACT.textMuted;
  return (
    <svg
      width={120}
      height={120}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
      style={{ margin: '75px 0 20px' }}
    >
      {/* Back card, tilted */}
      <g transform="rotate(-8 60 58)">
        <rect x={24} y={30} width={72} height={44} rx={6} fill={fill} stroke={stroke} strokeWidth={1.5} />
        <circle cx={36} cy={44} r={5} fill={line} opacity={0.5} />
        <rect x={47} y={40} width={38} height={4} rx={2} fill={line} opacity={0.35} />
        <rect x={47} y={48} width={26} height={4} rx={2} fill={line} opacity={0.25} />
        <circle cx={36} cy={62} r={5} fill={line} opacity={0.5} />
        <rect x={47} y={58} width={38} height={4} rx={2} fill={line} opacity={0.35} />
        <rect x={47} y={66} width={26} height={4} rx={2} fill={line} opacity={0.25} />
      </g>

      {/* Front card */}
      <g transform="translate(0 6)">
        <rect x={26} y={42} width={72} height={44} rx={6} fill={fill} stroke={stroke} strokeWidth={1.5} />
        <circle cx={38} cy={56} r={5} fill={line} opacity={0.6} />
        <rect x={49} y={52} width={40} height={4} rx={2} fill={line} opacity={0.45} />
        <rect x={49} y={60} width={28} height={4} rx={2} fill={line} opacity={0.3} />
        <circle cx={38} cy={74} r={5} fill={line} opacity={0.6} />
        <rect x={49} y={70} width={40} height={4} rx={2} fill={line} opacity={0.45} />
        <rect x={49} y={78} width={28} height={4} rx={2} fill={line} opacity={0.3} />
      </g>

      {/* Activity-pulse badge, lower-right */}
      <circle cx={92} cy={92} r={13} fill={ACT.bg} stroke={stroke} strokeWidth={1.5} />
      <path
        d="M85 92h3l2-4 3 8 2-4h3"
        stroke={line}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ActivityEmpty({ searching }: { searching: boolean }) {
  const key = searching ? 'search' : 'default';
  return (
    <div
      data-test="activity-list__empty"
      data-testid="activity-empty"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        textAlign: 'center',
        flex: 1,
        minHeight: 0,
      }}
    >
      <NoActivityArt />
      <h4
        data-test="activity-list__empty-text"
        style={{ margin: 0, fontSize: 16, fontWeight: 600, color: ACT.textPrimary }}
      >
        {HEADING[key]}
      </h4>
      <p
        data-test="activity-list__empty-desc"
        style={{ margin: '4px 0 0', fontSize: 13, color: ACT.textMuted, maxWidth: 320 }}
      >
        {DESC[key]}
      </p>
    </div>
  );
}
