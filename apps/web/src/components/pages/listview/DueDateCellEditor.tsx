'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { monthGrid, monthLabel, quickDates, WEEKDAY_LABELS } from './calendar';
import { PickerRow } from './menu-parts';
import { LV } from './tokens';

type Tab = 'start' | 'due';

/** Due/Start date picker with quick options and a navigable month calendar. */
export function DueDateCellEditor({
  task,
  trigger,
}: {
  task: Task;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const [tab, setTab] = useState<Tab>('due');
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const apply = (value: number | null) =>
    updateTask(task.id, tab === 'due' ? { dueDate: value } : { startDate: value });

  const selected = tab === 'due' ? task.dueDate : task.startDate;
  const grid = monthGrid(cursor.year, cursor.month);

  const shiftMonth = (delta: number) => {
    const m = cursor.month + delta;
    setCursor({
      year: cursor.year + Math.floor(m / 12),
      month: ((m % 12) + 12) % 12,
    });
  };

  return (
    <Menu width={300} align="left" trigger={trigger}>
      {/* Start / Due tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 10px', borderBottom: `1px solid ${LV.border}` }}>
        {(['start', 'due'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={(e) => {
              e.stopPropagation();
              setTab(t);
            }}
            style={{
              flex: 1,
              height: 28,
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'capitalize',
              color: tab === t ? LV.textPrimary : LV.textMuted,
              background: tab === t ? LV.hover : 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t} date
          </button>
        ))}
      </div>

      {/* Quick options */}
      <div style={{ padding: '4px 0' }}>
        {quickDates().map((q) => (
          <PickerRow
            key={q.label}
            onClick={() => apply(q.value)}
            trailing={<span style={{ fontSize: 12, color: LV.textMuted }}>{q.hint}</span>}
          >
            <span style={{ fontSize: 13, color: LV.textPrimary }}>{q.label}</span>
          </PickerRow>
        ))}
      </div>

      {/* Calendar */}
      <div style={{ borderTop: `1px solid ${LV.border}`, padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); shiftMonth(-1); }} style={navBtn}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: LV.textPrimary }}>
            {monthLabel(cursor.year, cursor.month)}
          </span>
          <button onClick={(e) => { e.stopPropagation(); shiftMonth(1); }} style={navBtn}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} style={{ fontSize: 11, color: LV.textMuted, textAlign: 'center', padding: '2px 0' }}>
              {w}
            </span>
          ))}
          {grid.map((c) => {
            const isSelected = selected != null && new Date(selected).setHours(0, 0, 0, 0) === c.date;
            return (
              <button
                key={c.date}
                onClick={(e) => { e.stopPropagation(); apply(c.date); }}
                style={{
                  height: 28,
                  fontSize: 12,
                  borderRadius: 6,
                  border: c.isToday ? `1px solid ${LV.accent}` : 'none',
                  background: isSelected ? LV.accent : 'transparent',
                  color: isSelected ? '#fff' : c.inMonth ? LV.textPrimary : LV.textMuted,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {c.day}
              </button>
            );
          })}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); apply(null); }}
          style={{
            marginTop: 8,
            width: '100%',
            height: 28,
            fontSize: 12,
            color: LV.textMuted,
            background: 'transparent',
            border: `1px solid ${LV.border}`,
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Clear date
        </button>
      </div>
    </Menu>
  );
}

const navBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  fontSize: 16,
  lineHeight: 1,
  color: LV.textSecondary,
  background: 'transparent',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};
