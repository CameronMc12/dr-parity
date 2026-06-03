'use client';

/**
 * Single sticky Table header row (one per grid, sticky at the top of the scroll
 * area — NOT repeated per group, exactly like ClickUp's Table). Columns: the
 * lead `#` header (holds the select-all checkbox), one sortable header per
 * visible column (click toggles asc → desc → none) with a right-edge resize
 * grip, custom-field headers for `cf:*` columns, and the trailing "+ add column"
 * button that opens the shared FieldsPanel.
 */

import { useState } from 'react';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import type { TableColumnId } from '@/store/workspace/view-config.types';
import { CheckboxIcon, PlusCircle } from '@/components/pages/list-view-icons';
import { CustomFieldHeader } from '@/components/fields';
import { columnLabel, fieldForColumn, type SortState } from './table-columns';
import { TBL, HEADER_HEIGHT, NUM_WIDTH, ADD_COL_WIDTH } from './tokens';

function SortCaret({ dir }: { dir: 'asc' | 'desc' }) {
  return (
    <span style={{ fontSize: 9, color: TBL.textSecondary, lineHeight: 1 }}>{dir === 'asc' ? '▲' : '▼'}</span>
  );
}

/** Right-edge drag grip that resizes the column it sits on. */
function ResizeHandle({ onResizeStart }: { onResizeStart: (clientX: number) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      data-testid="tbl-col-resize"
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onResizeStart(e.clientX);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        top: 0,
        right: -3,
        width: 7,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 3,
        background: hover ? TBL.indigoText : 'transparent',
        opacity: hover ? 0.6 : 1,
      }}
    />
  );
}

/** Right-aligned kebab that opens the column-header menu (parity with ClickUp). */
function HeaderKebab({ onOpen }: { onOpen: (anchor: { x: number; y: number }) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      aria-label="Column options"
      data-testid="tbl-col-kebab"
      aria-haspopup="menu"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        onOpen({ x: r.left, y: r.bottom });
      }}
      style={{
        flexShrink: 0,
        width: 18,
        height: 18,
        marginRight: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: hover ? TBL.textSecondary : TBL.textMuted,
        opacity: hover ? 1 : 0.85,
        padding: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="12" cy="19" r="1.6" />
      </svg>
    </button>
  );
}

function HeaderCell({
  col,
  fields,
  listId,
  active,
  dir,
  onSort,
  onResizeStart,
  onHeaderMenu,
}: {
  col: TableColumnId;
  fields: CustomFieldDef[];
  listId: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onSort: (col: TableColumnId) => void;
  onResizeStart: (col: TableColumnId, clientX: number) => void;
  onHeaderMenu: (col: TableColumnId, anchor: { x: number; y: number }) => void;
}) {
  const [hover, setHover] = useState(false);
  const field = fieldForColumn(col, fields);
  const openMenu = (anchor: { x: number; y: number }) => onHeaderMenu(col, anchor);

  // Custom-field column: render the shared CustomFieldHeader (icon + name +
  // kebab). It carries its own click target, so the whole cell isn't a sort
  // button — but the right-edge resize grip still works.
  if (field) {
    return (
      <div
        data-testid={`tbl-header-${col}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu({ x: e.clientX, y: e.clientY });
        }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          background: hover ? TBL.hover : 'transparent',
          borderRight: `1px solid ${TBL.gridline}`,
          transition: hover ? 'background 120ms' : undefined,
        }}
      >
        <button
          onClick={() => onSort(col)}
          aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <CustomFieldHeader field={field} listId={listId} />
        </button>
        {active && <span style={{ paddingRight: 6 }}><SortCaret dir={dir} /></span>}
        {hover && <HeaderKebab onOpen={openMenu} />}
        <ResizeHandle onResizeStart={(x) => onResizeStart(col, x)} />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu({ x: e.clientX, y: e.clientY });
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        background: hover ? TBL.hover : 'transparent',
        borderRight: `1px solid ${TBL.gridline}`,
        transition: hover ? 'background 120ms' : undefined,
      }}
    >
      <button
        data-testid={`tbl-header-${col}`}
        onClick={() => onSort(col)}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          height: '100%',
          padding: '0 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: active ? TBL.textPrimary : TBL.textMuted,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{columnLabel(col, fields)}</span>
        {active && <SortCaret dir={dir} />}
      </button>
      {hover && <HeaderKebab onOpen={openMenu} />}
      <ResizeHandle onResizeStart={(x) => onResizeStart(col, x)} />
    </div>
  );
}

export function TableHeaderRow({
  visibleColumns,
  fields,
  listId,
  gridTemplate,
  sort,
  onSort,
  onResizeStart,
  allSelected,
  someSelected,
  onToggleAll,
  onAddColumn,
  onHeaderMenu,
}: {
  visibleColumns: TableColumnId[];
  fields: CustomFieldDef[];
  listId: string;
  gridTemplate: string;
  sort: SortState | null;
  onSort: (col: TableColumnId) => void;
  onResizeStart: (col: TableColumnId, clientX: number) => void;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onAddColumn: (anchor: { x: number; y: number }) => void;
  onHeaderMenu: (col: TableColumnId, anchor: { x: number; y: number }) => void;
}) {
  const [numHover, setNumHover] = useState(false);
  const [addHover, setAddHover] = useState(false);
  const columns: TableColumnId[] = ['name', ...visibleColumns];

  return (
    <div
      data-testid="tbl-header-row"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        height: HEADER_HEIGHT,
        background: TBL.headerBg,
        borderTop: `1px solid ${TBL.gridline}`,
        borderBottom: `1px solid ${TBL.gridline}`,
      }}
    >
      {/* Lead "#" header: the select-all checkbox lives here (ClickUp merges
          the row-number + select column into a single 40px track). */}
      <div
        data-testid="tbl-rownum-header"
        onMouseEnter={() => setNumHover(true)}
        onMouseLeave={() => setNumHover(false)}
        style={{
          width: NUM_WIDTH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: `1px solid ${TBL.gridline}`,
          fontSize: 11,
          fontWeight: 600,
          color: TBL.textMuted,
        }}
      >
        {numHover || someSelected || allSelected ? (
          <button
            aria-label={allSelected ? 'Deselect all' : 'Select all'}
            data-testid="tbl-select-all"
            onClick={onToggleAll}
            style={{
              width: 18,
              height: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: TBL.textMuted,
            }}
          >
            <CheckboxIcon size={16} checked={allSelected} />
          </button>
        ) : (
          <span>#</span>
        )}
      </div>

      {columns.map((col) => (
        <HeaderCell
          key={col}
          col={col}
          fields={fields}
          listId={listId}
          active={sort?.col === col}
          dir={sort?.col === col ? sort.dir : 'asc'}
          onSort={onSort}
          onResizeStart={onResizeStart}
          onHeaderMenu={onHeaderMenu}
        />
      ))}

      <button
        aria-label="Add a Column"
        title="Add a Column"
        data-testid="tbl-add-column"
        aria-haspopup="dialog"
        onMouseEnter={() => setAddHover(true)}
        onMouseLeave={() => setAddHover(false)}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onAddColumn({ x: r.left, y: r.bottom + 4 });
        }}
        style={{
          width: ADD_COL_WIDTH,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 6,
          paddingLeft: 10,
          background: addHover ? TBL.hover : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: addHover ? TBL.textSecondary : TBL.textMuted,
        }}
      >
        <PlusCircle size={16} />
      </button>
    </div>
  );
}
