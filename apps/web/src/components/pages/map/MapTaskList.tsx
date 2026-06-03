'use client';

/**
 * Left task panel for the Map view. Lists every task with its derived city and a
 * status dot. Hovering a row syncs the highlight with its map pin; clicking opens
 * the task; right-click opens the shared task context menu. Empty state mirrors
 * ClickUp's muted copy.
 */

import { useState } from 'react';
import type { Task } from '@/store/workspace/types';
import type { PlacedTask } from './geo';
import { MAP } from './tokens';

function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

function AssigneeChip({ task }: { task: Task }) {
  const first = task.assignees[0];
  if (!first) return null;
  return (
    <span
      title={first.name}
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: first.color || '#7b68ee',
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {first.initials || first.name.charAt(0).toUpperCase()}
    </span>
  );
}

function TaskRow({
  placed,
  active,
  onOpen,
  onContextMenu,
  onHover,
}: {
  placed: PlacedTask;
  active: boolean;
  onOpen: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  onHover: (taskId: string | null) => void;
}) {
  const { task, location } = placed;
  const [hover, setHover] = useState(false);
  return (
    <div
      data-testid="map-task-row"
      data-task-id={task.id}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onContextMenu={(e) => onContextMenu(e, task)}
      onMouseEnter={() => {
        setHover(true);
        onHover(task.id);
      }}
      onMouseLeave={() => {
        setHover(false);
        onHover(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(task.id);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: MAP.rowHeight,
        padding: '6px 16px',
        cursor: 'pointer',
        background: active ? MAP.rowActiveBg : hover ? MAP.hoverBg : 'transparent',
        borderLeft: `2px solid ${active ? task.statusColor || MAP.accent : 'transparent'}`,
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <StatusDot color={task.statusColor || MAP.accent} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: MAP.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {task.name}
        </span>
        <span style={{ fontSize: 11, color: MAP.textMuted }}>
          {location.city.name}, {location.city.country}
        </span>
      </span>
      <AssigneeChip task={task} />
    </div>
  );
}

export function MapTaskList({
  placed,
  hoveredId,
  onOpen,
  onContextMenu,
  onHover,
}: {
  placed: PlacedTask[];
  hoveredId: string | null;
  onOpen: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  onHover: (taskId: string | null) => void;
}) {
  return (
    <div
      data-testid="map-task-list"
      style={{
        width: MAP.panelWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: MAP.panelBg,
        borderRight: `1px solid ${MAP.border}`,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '12px 16px 8px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: MAP.textMuted,
        }}
      >
        Locations · {placed.length}
      </div>

      {placed.length === 0 ? (
        <div style={{ padding: '24px 16px', fontSize: 13, color: MAP.textMuted }}>
          No tasks match the current filters.
        </div>
      ) : (
        placed.map((item) => (
          <TaskRow
            key={item.task.id}
            placed={item}
            active={hoveredId === item.task.id}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            onHover={onHover}
          />
        ))
      )}
    </div>
  );
}
