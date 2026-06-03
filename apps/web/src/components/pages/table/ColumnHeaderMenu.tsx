'use client';

/**
 * Column-header right-click / kebab menu for the Table view.
 *
 * Mirrors ClickUp's column-header popover captured at
 * docs/research/clickup-parity/interactions/table/addcolumn.png — the menu set,
 * order, and footer "Prioritize with AI" button. The shared `Menu` primitive
 * only anchors to a trigger rect, so this renders a `position: fixed` cursor-
 * anchored surface exactly like `TaskContextMenu`, reusing `MenuItem` /
 * `MenuDivider` so the dark-theme styling is byte-identical to the kebab menus.
 *
 * Wiring (real actions where a backing model exists):
 *   - Sort      → submenu Ascending / Descending → onSort(col, dir)
 *   - Group     → setGroupBy(listId, field)  (status / priority / assignee only)
 *   - Insert L/R → open FieldsPanel anchored at the header (add a custom column)
 *   - Fit       → onFit(col)            local width auto-fit
 *   - Pin       → onTogglePin(col)      local column-state
 *   - Move      → onMove(col, start|end) local column order
 *   - Hide      → toggleColumn(listId, col)
 *   - Delete    → toggleColumn (custom columns only — removes from the view)
 *
 * Items with no backing model (Calculate, Automate, Prioritize with AI) render
 * for parity and close as no-ops.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { MenuDivider, MenuItem } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { GroupByField } from '@/store/workspace/view-config.types';
import { isCustomFieldColumn, type TableColumnId } from '@/store/workspace/view-config.types';
import type { SortDir } from './table-columns';

const MENU_BG = 'var(--cu-bg-menu, #fff)';
const MENU_BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const MENU_SHADOW = 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.16))';
const TEXT_SECONDARY = 'var(--cu-text-secondary, rgb(90,90,90))';
const ACCENT = 'var(--cu-accent, #4ecdc4)';
const DANGER = 'rgb(226, 67, 41)';

const MENU_WIDTH = 200;
const EST_HEIGHT = 460;

export interface ColumnMenuPos {
  x: number;
  y: number;
}

/** Built-in columns that ClickUp can group the board by. */
const GROUPABLE: Partial<Record<TableColumnId, GroupByField>> = {
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
};

// ── Icons (mirror TaskContextMenu weight) ───────────────────────────────────

const ICON = 16;
function I({ d }: { d: string }) {
  return (
    <svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SortIcon = () => <I d="M8 4v16M8 4l-3 3M8 4l3 3M16 20V4M16 20l-3-3M16 20l3-3" />;
const GroupIcon = () => <I d="M4 6h16M4 12h10M4 18h16" />;
const InsertLeftIcon = () => <I d="M10 5h9v14h-9M5 12h3M5 12l2-2M5 12l2 2" />;
const InsertRightIcon = () => <I d="M14 5H5v14h9M19 12h-3M19 12l-2-2M19 12l-2 2" />;
const FitIcon = () => <I d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4M9 12h6" />;
const PinIcon = () => <I d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 18v3" />;
const MoveStartIcon = () => <I d="M5 5v14M19 12H9M9 12l4-4M9 12l4 4" />;
const MoveEndIcon = () => <I d="M19 5v14M5 12h10M15 12l-4-4M15 12l-4 4" />;
const CalcIcon = () => <I d="M5 4h14v16H5zM8 8h8M8 12h3M14 12h2M8 16h3M14 16h2" />;
const AutomateIcon = () => <I d="M13 3l-9 11h7l-1 7 9-11h-7l1-7z" />;
const HideIcon = () => <I d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7zM4 4l16 16M10 10a2.5 2.5 0 0 0 3.5 3.5" />;
const DeleteIcon = () => <I d="M5 7h14M9.5 7V5h5v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18 7" />;
const AiIcon = () => <I d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />;

function CheckMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4 10-10" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortSubmenu({
  col,
  activeDir,
  onSort,
}: {
  col: TableColumnId;
  activeDir: SortDir | null;
  onSort: (col: TableColumnId, dir: SortDir) => void;
}) {
  return (
    <>
      <MenuItem
        label="Ascending"
        trailing={activeDir === 'asc' ? <CheckMark /> : undefined}
        active={activeDir === 'asc'}
        onSelect={() => onSort(col, 'asc')}
      />
      <MenuItem
        label="Descending"
        trailing={activeDir === 'desc' ? <CheckMark /> : undefined}
        active={activeDir === 'desc'}
        onSelect={() => onSort(col, 'desc')}
      />
    </>
  );
}

export interface ColumnHeaderMenuProps {
  col: TableColumnId;
  listId: string;
  pos: ColumnMenuPos;
  /** Current local sort direction on this column, or null when unsorted. */
  activeDir: SortDir | null;
  /** True when this column is pinned (local state). */
  pinned: boolean;
  onClose: () => void;
  onSort: (col: TableColumnId, dir: SortDir) => void;
  onInsert: (col: TableColumnId, side: 'left' | 'right', anchor: ColumnMenuPos) => void;
  onFit: (col: TableColumnId) => void;
  onTogglePin: (col: TableColumnId) => void;
  onMove: (col: TableColumnId, edge: 'start' | 'end') => void;
}

export function ColumnHeaderMenu({
  col,
  listId,
  pos,
  activeDir,
  pinned,
  onClose,
  onSort,
  onInsert,
  onFit,
  onTogglePin,
  onMove,
}: ColumnHeaderMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const setGroupBy = useWorkspaceStore((s) => s.setGroupBy);
  const toggleColumn = useWorkspaceStore((s) => s.toggleColumn);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  const isCustom = isCustomFieldColumn(col);
  const isName = col === 'name';
  const groupField = GROUPABLE[col];

  const insert = (side: 'left' | 'right') => {
    onInsert(col, side, pos);
    onClose();
  };

  // Cursor-anchored placement with viewport flips (mirrors TaskContextMenu).
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const flipUp = vh - pos.y < EST_HEIGHT;
  const left = Math.min(pos.x, vw - MENU_WIDTH - 8);

  return (
    <div
      ref={ref}
      role="menu"
      data-testid="tbl-colmenu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        zIndex: 9999,
        width: MENU_WIDTH,
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
        left,
        ...(flipUp ? { bottom: vh - pos.y + 4 } : { top: pos.y + 4 }),
        background: MENU_BG,
        border: `1px solid ${MENU_BORDER}`,
        borderRadius: 8,
        boxShadow: MENU_SHADOW,
        padding: '6px 0',
        boxSizing: 'border-box',
        font: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
        animation: 'cuMenuIn 110ms ease',
      }}
    >
      <MenuItem
        icon={<SortIcon />}
        label="Sort"
        submenu={<SortSubmenu col={col} activeDir={activeDir} onSort={onSort} />}
      />
      <MenuItem
        icon={<GroupIcon />}
        label="Group"
        onSelect={groupField ? () => act(() => setGroupBy(listId, groupField)) : onClose}
      />
      <MenuItem icon={<InsertLeftIcon />} label="Insert left" onSelect={() => insert('left')} />
      <MenuItem icon={<InsertRightIcon />} label="Insert right" onSelect={() => insert('right')} />
      <MenuItem icon={<FitIcon />} label="Fit to content" onSelect={() => act(() => onFit(col))} />
      <MenuItem
        icon={<PinIcon />}
        label={pinned ? 'Unpin column' : 'Pin column'}
        onSelect={() => act(() => onTogglePin(col))}
      />
      <MenuDivider />
      <MenuItem icon={<MoveStartIcon />} label="Move to start" onSelect={() => act(() => onMove(col, 'start'))} />
      <MenuItem icon={<MoveEndIcon />} label="Move to end" onSelect={() => act(() => onMove(col, 'end'))} />
      <MenuItem icon={<CalcIcon />} label="Calculate" onSelect={onClose} />
      <MenuItem icon={<AutomateIcon />} label="Automate" onSelect={onClose} />
      {!isName && (
        <MenuItem
          icon={<HideIcon />}
          label="Hide column"
          onSelect={() => act(() => toggleColumn(listId, col))}
        />
      )}
      {isCustom && (
        <MenuItem
          icon={<span style={{ color: DANGER }}><DeleteIcon /></span>}
          label={<span style={{ color: DANGER }}>Delete column</span>}
          onSelect={() => act(() => toggleColumn(listId, col))}
        />
      )}
      <MenuDivider />
      <PrioritizeRow onClose={onClose} />
    </div>
  );
}

/** Footer "Prioritize with AI" row — parity-only, closes as a no-op. */
function PrioritizeRow({ onClose }: { onClose: () => void }): ReactNode {
  return (
    <MenuItem
      icon={<span style={{ color: ACCENT }}><AiIcon /></span>}
      label={<span style={{ color: TEXT_SECONDARY }}>Prioritize with AI</span>}
      onSelect={onClose}
    />
  );
}
