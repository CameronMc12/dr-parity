'use client';

/**
 * Filter controls for a dashboard. Two multi-select dropdowns (status,
 * assignee) plus a clear affordance. Changing a selection emits a new filter
 * state up to DashboardDetail, which recomputes every widget.
 */

import { useEffect, useRef, useState } from 'react';
import { BORDER, TEXT_SECONDARY, TEXT_PRIMARY, TEXT_MUTED, HOVER_BG } from '../page-primitives';
import type { Member } from '@/store/workspace/types';
import type { StatusSlice } from '../dashboard/dashboard-data';
import type { HubFilterState } from './hub-metrics';
import { CheckIcon, FilterIcon, CaretDownIcon } from './dashboards-hub-icons';

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onClose]);
  return ref;
}

interface OptionRowProps {
  label: string;
  color?: string;
  selected: boolean;
  onToggle: () => void;
}

function OptionRow({ label, color, selected, onToggle }: OptionRowProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '7px 10px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        color: TEXT_SECONDARY,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {color && <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0 }} />}
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      <span style={{ width: 16, height: 16, color: selected ? TEXT_PRIMARY : 'transparent', flexShrink: 0 }}>
        <CheckIcon size={16} />
      </span>
    </button>
  );
}

function Dropdown({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 8px 0 10px',
          background: count > 0 ? 'rgb(238, 240, 243)' : 'transparent',
          border: `1px solid ${count > 0 ? 'transparent' : BORDER}`,
          borderRadius: 6,
          cursor: 'pointer',
          color: TEXT_SECONDARY,
          fontSize: 13,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (count === 0) e.currentTarget.style.background = HOVER_BG;
        }}
        onMouseLeave={(e) => {
          if (count === 0) e.currentTarget.style.background = 'transparent';
        }}
      >
        {label}
        {count > 0 && (
          <span
            style={{
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              background: TEXT_PRIMARY,
              color: 'white',
              fontSize: 10,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {count}
          </span>
        )}
        <CaretDownIcon size={12} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 200,
            maxHeight: 280,
            overflowY: 'auto',
            background: 'white',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(16, 24, 40, 0.14)',
            padding: 4,
            zIndex: 40,
          }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function HubFilterBar({
  statuses,
  members,
  filter,
  onChange,
}: {
  statuses: StatusSlice[];
  members: Member[];
  filter: HubFilterState;
  onChange: (next: HubFilterState) => void;
}) {
  const active = filter.statuses.length > 0 || filter.assignees.length > 0;

  const toggleStatus = (status: string) => {
    const next = filter.statuses.includes(status)
      ? filter.statuses.filter((s) => s !== status)
      : [...filter.statuses, status];
    onChange({ ...filter, statuses: next });
  };

  const toggleAssignee = (id: string) => {
    const next = filter.assignees.includes(id)
      ? filter.assignees.filter((a) => a !== id)
      : [...filter.assignees, id];
    onChange({ ...filter, assignees: next });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'inline-flex', color: TEXT_MUTED }}>
        <FilterIcon size={14} />
      </span>
      <Dropdown label="Status" count={filter.statuses.length}>
        {() =>
          statuses.length ? (
            statuses.map((s) => (
              <OptionRow
                key={s.status}
                label={s.status}
                color={s.color}
                selected={filter.statuses.includes(s.status)}
                onToggle={() => toggleStatus(s.status)}
              />
            ))
          ) : (
            <div style={{ padding: 10, fontSize: 12, color: TEXT_MUTED }}>No statuses</div>
          )
        }
      </Dropdown>
      <Dropdown label="Assignee" count={filter.assignees.length}>
        {() => (
          <>
            {members.map((m) => (
              <OptionRow
                key={m.id}
                label={m.name}
                color={m.color}
                selected={filter.assignees.includes(m.id)}
                onToggle={() => toggleAssignee(m.id)}
              />
            ))}
            <OptionRow
              label="Unassigned"
              color="#c9ced6"
              selected={filter.assignees.includes('__none__')}
              onToggle={() => toggleAssignee('__none__')}
            />
          </>
        )}
      </Dropdown>
      {active && (
        <button
          onClick={() => onChange({ statuses: [], assignees: [] })}
          style={{
            height: 30,
            padding: '0 10px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: TEXT_MUTED,
            fontSize: 13,
            fontWeight: 500,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_PRIMARY)}
          onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_MUTED)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
