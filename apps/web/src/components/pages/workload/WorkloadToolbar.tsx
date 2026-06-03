'use client';

/**
 * Workload control row that brackets the shared `<ViewToolbar>`.
 *
 *   LEFT  — Today | metric dropdown (Time Estimates / Tasks / Points) | range
 *           dropdown (1 week / 14 days / 4 weeks) | "Daily Scheduled" dropdown |
 *           "Save view" dropdown.
 *   RIGHT — "Backlog" toggle pill (the shared Group/Filter/Closed/Assignee/
 *           search/Customize/Add-Task cluster is rendered by `<ViewToolbar>`).
 *
 * Each dropdown drives a real piece of view state; nothing is a dead control.
 */

import { useEffect, useRef, useState } from 'react';
import {
  WL,
  METRIC_OPTIONS,
  RANGE_OPTIONS,
  type WorkloadMetric,
  type WorkloadRangeDays,
} from './tokens';
import type { ScheduleMode } from './periods';

const SCHEDULE_OPTIONS: readonly ScheduleMode[] = ['Daily Scheduled', 'Total Scheduled'];
const SAVE_OPTIONS = ['Save view', 'Save as new view', 'Reset to default'] as const;

function CaretIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TodayIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth={1.6} />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth={1.6} />
      <circle cx="12" cy="15" r="2.4" fill="currentColor" />
    </svg>
  );
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open, close]);
  return ref;
}

function dropdownBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    padding: '0 10px',
    background: active ? WL.hover : 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: active ? WL.textPrimary : WL.textSecondary,
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    transition: 'background 120ms',
  };
}

function Dropdown<T extends string | number>({
  testid,
  label,
  value,
  options,
  onSelect,
}: {
  testid: string;
  /** Optional leading text (e.g. metric name); falls back to selected label. */
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useOutside(open, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        data-testid={testid}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={dropdownBtnStyle(hover || open)}
      >
        {label}
        <CaretIcon />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 34,
            left: 0,
            minWidth: 160,
            padding: 4,
            background: WL.menuBg,
            border: `1px solid ${WL.gridBorder}`,
            borderRadius: 8,
            boxShadow: 'var(--cu-shadow-lg)',
            zIndex: 60,
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                role="menuitemradio"
                aria-checked={active}
                data-testid={`${testid}-${opt.value}`}
                onClick={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  height: 30,
                  padding: '0 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: active ? WL.textPrimary : WL.textSecondary,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = WL.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionDropdown({
  testid,
  label,
  options,
  onSelect,
}: {
  testid: string;
  label: string;
  options: readonly string[];
  onSelect: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useOutside(open, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        data-testid={testid}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={dropdownBtnStyle(hover || open)}
      >
        {label}
        <CaretIcon />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 34,
            left: 0,
            minWidth: 180,
            padding: 4,
            background: WL.menuBg,
            border: `1px solid ${WL.gridBorder}`,
            borderRadius: 8,
            boxShadow: 'var(--cu-shadow-lg)',
            zIndex: 60,
          }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              role="menuitem"
              data-testid={`${testid}-${opt.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => {
                onSelect(opt);
                setOpen(false);
              }}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                height: 30,
                padding: '0 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                color: WL.textSecondary,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = WL.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkloadToolbarLeft({
  metric,
  onMetric,
  range,
  onRange,
  schedule,
  onSchedule,
  onToday,
  onSaveAction,
}: {
  metric: WorkloadMetric;
  onMetric: (m: WorkloadMetric) => void;
  range: WorkloadRangeDays;
  onRange: (r: WorkloadRangeDays) => void;
  schedule: ScheduleMode;
  onSchedule: (s: ScheduleMode) => void;
  onToday: () => void;
  onSaveAction: (action: string) => void;
}) {
  const metricLabel = METRIC_OPTIONS.find((o) => o.value === metric)?.label ?? 'Time Estimates';
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? '2 weeks';

  const [todayHover, setTodayHover] = useState(false);

  return (
    <div
      data-testid="workload-toolbar-left"
      style={{ display: 'flex', alignItems: 'center', gap: 2, height: 40, paddingLeft: 12, flexShrink: 0 }}
    >
      <button
        data-testid="workload-today"
        onClick={onToday}
        onMouseEnter={() => setTodayHover(true)}
        onMouseLeave={() => setTodayHover(false)}
        style={{
          ...dropdownBtnStyle(todayHover),
          color: todayHover ? WL.textPrimary : WL.textSecondary,
        }}
      >
        <TodayIcon />
        Today
      </button>
      <span style={{ width: 1, height: 18, background: WL.gridBorder, margin: '0 4px' }} />
      <Dropdown
        testid="workload-metric"
        label={metricLabel}
        value={metric}
        options={METRIC_OPTIONS}
        onSelect={onMetric}
      />
      <Dropdown
        testid="workload-range"
        label={rangeLabel}
        value={range}
        options={RANGE_OPTIONS}
        onSelect={onRange}
      />
      <ActionDropdown
        testid="workload-schedule"
        label={schedule}
        options={SCHEDULE_OPTIONS}
        onSelect={(s) => onSchedule(s as ScheduleMode)}
      />
      <ActionDropdown
        testid="workload-save"
        label="Save view"
        options={SAVE_OPTIONS}
        onSelect={onSaveAction}
      />
    </div>
  );
}

export function BacklogToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      data-testid="workload-backlog"
      aria-pressed={active}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 12px',
        marginLeft: 6,
        background: active ? WL.indigo : hover ? WL.hover : 'transparent',
        border: `1px solid ${active ? 'transparent' : WL.gridBorderStrong}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? WL.indigoText : WL.textSecondary,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
        transition: 'background 120ms',
      }}
    >
      Backlog
    </button>
  );
}

export type { ScheduleMode };
export { SAVE_OPTIONS };
