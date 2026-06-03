'use client';

/**
 * A single status column (board-group). Renders the status-indicator header
 * (`BoardColumnHeader`), a top "+ Add Task" link, the card stack with
 * between-card drop slots, and a footer "+ Add Task" affordance. Collapsed
 * columns shrink to a vertical rail like ClickUp's `collapse_empty_columns`.
 */

import type { Task } from '@/store/workspace/types';
import type { StatusColumn } from '@/lib/view-data';
import { Chevron } from '../list-view-icons';
import { BoardCard } from './BoardCard';
import { BoardColumnHeader, AddTaskRow } from './BoardColumnHeader';
import { StatusGroupIcon, statusGroupKind } from './StatusGroupIcon';
import type { BoardDnd } from './useBoardDnd';
import { BOARD, columnBodyTint, columnTint, type CardSize } from './tokens';

function DropSlot({ active, onEnter }: { active: boolean; onEnter: () => void }) {
  return (
    <div
      onDragEnter={onEnter}
      onDragOver={(e) => {
        e.preventDefault();
        onEnter();
      }}
      style={{
        height: active ? 3 : BOARD.cardGap,
        margin: active ? `${(BOARD.cardGap - 3) / 2}px 0` : 0,
        borderRadius: 2,
        background: active ? BOARD.dropRing : 'transparent',
        transition: 'background 80ms',
      }}
    />
  );
}

function CollapsedColumn({
  column,
  statusType,
  count,
  onToggle,
}: {
  column: StatusColumn;
  statusType: string;
  count: number;
  onToggle: () => void;
}) {
  const kind = statusGroupKind(statusType, column.status);
  return (
    <div
      data-testid="board-column"
      data-collapsed="true"
      data-status={column.status}
      style={{
        width: BOARD.collapsedWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        background: columnTint(column.color),
        borderRadius: BOARD.cardRadius,
        height: '100%',
      }}
    >
      <button
        data-testid="board-column-collapse"
        aria-label={`Expand ${column.status}`}
        aria-expanded={false}
        onClick={onToggle}
        style={{
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: BOARD.textSecondary,
          transform: 'rotate(-90deg)',
        }}
      >
        <Chevron open={false} />
      </button>
      <StatusGroupIcon kind={kind} color={column.color} size={14} />
      <span
        style={{
          writingMode: 'vertical-rl',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: column.color,
        }}
      >
        {column.status}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: BOARD.textMuted }}>{count}</span>
    </div>
  );
}

export function BoardColumn({
  column,
  statusType,
  cards,
  collapsed,
  cardSize,
  dnd,
  onToggleCollapse,
  onAddCard,
  onCardContextMenu,
  onCollapseAll,
  onDeleteGroup,
}: {
  column: StatusColumn;
  statusType: string;
  cards: Task[];
  collapsed: boolean;
  cardSize: CardSize;
  dnd: BoardDnd;
  onToggleCollapse: () => void;
  onAddCard: () => void;
  onCardContextMenu: (e: React.MouseEvent, task: Task) => void;
  onCollapseAll?: () => void;
  /** Present only for user-added empty groups — enables "Delete group". */
  onDeleteGroup?: () => void;
}) {
  if (collapsed) {
    return (
      <CollapsedColumn
        column={column}
        statusType={statusType}
        count={column.tasks.length}
        onToggle={onToggleCollapse}
      />
    );
  }

  const active = dnd.isColumnActive(column.key);
  const empty = cards.length === 0;

  return (
    <div
      data-testid="board-column"
      data-status={column.status}
      style={{
        width: BOARD.columnWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <BoardColumnHeader
        column={column}
        statusType={statusType}
        count={column.tasks.length}
        collapsed={collapsed}
        onToggle={onToggleCollapse}
        onAdd={onAddCard}
        onCollapseAll={onCollapseAll}
        onDeleteGroup={onDeleteGroup}
      />

      <div
        data-testid="board-column-body"
        onDragOver={(e) => {
          if (!dnd.draggingId) return;
          e.preventDefault();
          if (empty) dnd.setDropTarget(column.key, 0);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dnd.commit();
        }}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          marginTop: 4,
          padding: 4,
          borderRadius: BOARD.cardRadius,
          background: columnBodyTint(column.color),
          outline: active && empty ? `1.5px dashed ${BOARD.dropRing}` : 'none',
          transition: 'background 100ms',
        }}
      >
        {/* Empty columns show "+ Add Task" directly under the header; populated
            columns move it to the footer below the card stack (ClickUp anatomy). */}
        {empty ? (
          <>
            <AddTaskRow onClick={onAddCard} />
            <div
              data-testid="board-column-empty"
              onDragEnter={() => dnd.setDropTarget(column.key, 0)}
              onDragOver={(e) => {
                e.preventDefault();
                dnd.setDropTarget(column.key, 0);
              }}
              style={{ minHeight: 8 }}
            />
          </>
        ) : (
          <>
            <div>
              {cards.map((task, i) => (
                <div key={task.id}>
                  <DropSlot
                    active={dnd.isSlotActive(column.key, i)}
                    onEnter={() => dnd.setDropTarget(column.key, i)}
                  />
                  <BoardCard
                    task={task}
                    cardSize={cardSize}
                    dragging={dnd.draggingId === task.id}
                    onDragStart={() => dnd.startDrag(task.id, column.key)}
                    onDragEnd={dnd.endDrag}
                    onContextMenu={onCardContextMenu}
                  />
                </div>
              ))}
              <DropSlot
                active={dnd.isSlotActive(column.key, cards.length)}
                onEnter={() => dnd.setDropTarget(column.key, cards.length)}
              />
            </div>
            <AddTaskRow onClick={onAddCard} />
          </>
        )}
      </div>
    </div>
  );
}
