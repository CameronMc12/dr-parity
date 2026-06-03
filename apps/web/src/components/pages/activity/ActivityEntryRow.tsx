'use client';

/**
 * A single Activity feed row: timeline dot + actor avatar, then a sentence
 * "<actor> <action> <task name>" with a right-aligned relative timestamp.
 *
 * Whole-row hover (HOVER_BG, 120ms) + click → openTask + right-click → the
 * shared task context menu. The task name is the keyboard-focusable affordance.
 */

import { memo, useState } from 'react';
import type { FeedEntry } from './activity-feed';
import { absoluteDate, relativeTime } from './relative-time';
import { ACT, ACTION_DOT, ACTION_VERB, RAIL } from './tokens';

interface ActivityEntryRowProps {
  entry: FeedEntry;
  /** The single newest entry in the whole feed reads "just now". */
  isLatest?: boolean;
  onOpen: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: FeedEntry) => void;
}

function ActivityEntryRowImpl({
  entry,
  isLatest,
  onOpen,
  onContextMenu,
}: ActivityEntryRowProps) {
  const [hover, setHover] = useState(false);
  const verb = ACTION_VERB[entry.action] ?? entry.action;
  const dotColor = ACTION_DOT[entry.action] ?? ACT.textMuted;
  const timeLabel = isLatest ? 'just now' : relativeTime(entry.at);

  return (
    <div
      data-testid="activity-entry"
      onClick={() => onOpen(entry.task.id)}
      onContextMenu={(e) => onContextMenu(e, entry)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '7px 16px 7px 8px',
        borderRadius: 6,
        cursor: 'pointer',
        background: hover ? ACT.hover : 'transparent',
        transition: 'background 120ms',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'relative',
          flexShrink: 0,
          width: RAIL.avatarSize,
          height: RAIL.avatarSize,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: -2,
            left: -2,
            width: RAIL.dotSize,
            height: RAIL.dotSize,
            borderRadius: '50%',
            background: dotColor,
            border: `2px solid ${ACT.bg}`,
            boxSizing: 'content-box',
          }}
        />
        <span
          title={entry.actorName}
          style={{
            width: RAIL.avatarSize,
            height: RAIL.avatarSize,
            borderRadius: '50%',
            background: entry.actorColor,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {entry.actorInitials}
        </span>
      </span>

      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          lineHeight: '24px',
          color: ACT.textSecondary,
        }}
      >
        <span style={{ fontWeight: 600, color: ACT.textPrimary }}>{entry.actorName}</span>{' '}
        {verb}{' '}
        <button
          type="button"
          data-testid="activity-task-link"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(entry.task.id);
          }}
          style={{
            display: 'inline',
            padding: 0,
            margin: 0,
            border: 'none',
            background: 'transparent',
            font: 'inherit',
            fontWeight: 600,
            color: ACT.textPrimary,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {entry.task.name}
        </button>
      </span>

      <span
        style={{
          flexShrink: 0,
          fontSize: 12,
          lineHeight: '24px',
          color: ACT.textMuted,
          whiteSpace: 'nowrap',
        }}
        title={absoluteDate(entry.at)}
      >
        {timeLabel}
      </span>
    </div>
  );
}

export const ActivityEntryRow = memo(ActivityEntryRowImpl);
