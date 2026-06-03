'use client';

/**
 * Sticky left rail: one label cell per swimlane, vertically aligned to the lane
 * heights in the chart body. Assignee lanes show an avatar dot + name; status
 * lanes show a status colour dot + label. Pinned left (sticky) so it stays
 * visible while the chart scrolls horizontally.
 */

import { TL } from './tokens';
import { laneHeight, type Swimlane } from './swimlanes';

export function LaneRail({
  lanes,
  showHeader = true,
}: {
  lanes: Swimlane[];
  /** Render the `Lanes` header. False for the flat `none` track (no swimlanes). */
  showHeader?: boolean;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        left: 0,
        zIndex: 4,
        flexShrink: 0,
        width: TL.railWidth,
        background: TL.railBg,
        borderRight: `1px solid ${TL.gridBorderStrong}`,
      }}
    >
      {/*
        Header spacer matching the date header height. The outer LaneRail is
        already sticky (left:0); a nested sticky here pins unreliably in Safari
        and older Chromium when the outer element has no constrained height, so
        the header is a plain block that aligns to TimelineHeader by height.

        With `groupBy: none` there are no real swimlanes, so we drop the `Lanes`
        label but keep the spacer height to stay row-aligned with TimelineHeader.
      */}
      <div
        style={{
          height: TL.headerHeight,
          borderBottom: `1px solid ${TL.gridBorderStrong}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: TL.textMuted,
        }}
      >
        {showHeader ? 'Lanes' : ''}
      </div>

      {lanes.map((lane) => (
        <LaneLabel key={lane.key} lane={lane} />
      ))}
    </div>
  );
}

function LaneLabel({ lane }: { lane: Swimlane }) {
  const isAssignee = lane.key.startsWith('assignee:');
  return (
    <div
      style={{
        height: laneHeight(lane.rowCount),
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 16,
        paddingRight: 12,
        borderBottom: `1px solid ${TL.gridBorder}`,
      }}
    >
      {isAssignee ? (
        <span
          aria-hidden
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            flexShrink: 0,
            background: lane.color,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {lane.member?.initials ?? lane.label.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            flexShrink: 0,
            background: lane.color,
          }}
        />
      )}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: TL.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lane.label}
        </span>
        <span style={{ fontSize: 11, color: TL.textMuted }}>
          {lane.taskCount} {lane.taskCount === 1 ? 'task' : 'tasks'}
        </span>
      </div>
    </div>
  );
}
