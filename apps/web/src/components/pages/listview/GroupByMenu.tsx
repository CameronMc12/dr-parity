'use client';

import { useState, type ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { GroupByField, SortDir } from '@/store/workspace/view-config.types';
import { CheckMark, PickerRow, SectionLabel } from './menu-parts';
import { LV } from './tokens';
import { CaretDown } from '../list-view-icons';

const FIELDS: { key: GroupByField; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
];

const FIELD_LABEL: Record<GroupByField, string> = {
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  none: 'None',
};

const DIR_LABEL: Record<SortDir, string> = { asc: 'Ascending', desc: 'Descending' };

/** A boxed select control (field / direction) matching ClickUp's group-by row. */
function SelectBox({
  label,
  onClick,
  width,
  open,
}: {
  label: ReactNode;
  onClick: () => void;
  width?: number;
  open?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        height: 32,
        width,
        flex: width ? undefined : 1,
        padding: '0 8px 0 10px',
        background: hover || open ? LV.hover : LV.input,
        border: `1px solid ${LV.border}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: LV.textPrimary,
        fontSize: 13,
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>{label}</span>
      <CaretDown />
    </button>
  );
}

function TrashButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      aria-label="Remove grouping"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? LV.hover : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: LV.textMuted,
        flexShrink: 0,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** "Group by" popover — field select + direction select + remove + More. */
export function GroupByMenu({
  listId,
  groupBy,
  sortDir,
  trigger,
}: {
  listId: string;
  groupBy: GroupByField;
  sortDir: SortDir;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const setGroupBy = useWorkspaceStore((s) => s.setGroupBy);
  const setSortDir = useWorkspaceStore((s) => s.setSortDir);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [dirOpen, setDirOpen] = useState(false);

  return (
    <Menu width={320} align="left" trigger={trigger}>
      <SectionLabel>Group by</SectionLabel>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 8px' }}>
        <SelectBox
          label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{FIELD_LABEL[groupBy]}</span>}
          open={fieldOpen}
          onClick={() => {
            setFieldOpen((v) => !v);
            setDirOpen(false);
          }}
        />
        <SelectBox
          width={120}
          label={DIR_LABEL[sortDir]}
          open={dirOpen}
          onClick={() => {
            setDirOpen((v) => !v);
            setFieldOpen(false);
          }}
        />
        <TrashButton onClick={() => setGroupBy(listId, 'none')} />
      </div>

      {fieldOpen && (
        <>
          <MenuDivider />
          {FIELDS.map((f) => (
            <PickerRow
              key={f.key}
              onClick={() => {
                setGroupBy(listId, f.key);
                setFieldOpen(false);
              }}
              active={groupBy === f.key}
              trailing={groupBy === f.key ? <CheckMark /> : undefined}
            >
              <span style={{ fontSize: 13, color: LV.textPrimary }}>{f.label}</span>
            </PickerRow>
          ))}
        </>
      )}

      {dirOpen && (
        <>
          <MenuDivider />
          {(['asc', 'desc'] as SortDir[]).map((d) => (
            <PickerRow
              key={d}
              onClick={() => {
                setSortDir(listId, d);
                setDirOpen(false);
              }}
              active={sortDir === d}
              trailing={sortDir === d ? <CheckMark /> : undefined}
            >
              <span style={{ fontSize: 13, color: LV.textPrimary }}>{DIR_LABEL[d]}</span>
            </PickerRow>
          ))}
        </>
      )}

      <MenuDivider />
      <PickerRow onClick={() => setGroupBy(listId, 'none')}>
        <span style={{ fontSize: 13, color: LV.textSecondary }}>Remove primary grouping</span>
      </PickerRow>
      <PickerRow onClick={() => undefined}>
        <span style={{ fontSize: 13, color: LV.textSecondary }}>More</span>
      </PickerRow>
    </Menu>
  );
}
