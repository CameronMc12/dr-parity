'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  PageSurface,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  BORDER,
  HOVER_BG,
  APP_BG,
} from '../page-primitives';
import {
  TIMESHEET_TASKS,
  WEEKDAY_LABELS,
  SEED_WEEK_START,
  SEED_TODAY_INDEX,
  type TimesheetTask,
} from '../../../data/timesheets-seed';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClockIcon,
  SettingsIcon,
  DollarIcon,
  TagIcon,
  TrackedTimeIcon,
  TimesheetViewIcon,
  ListViewIcon,
  UsersIcon,
  CopyIcon,
  PlusCircleIcon,
  TimerIcon,
  StopwatchHero,
} from './timesheet-icons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ACTIVE_LINE = 'var(--cu-text-primary, rgb(32, 32, 32))';
const GRID = 'var(--cu-border-divider, rgb(232, 232, 232))';
const TASK_COL_WIDTH = 260;
const DAY_COL_WIDTH = 92;
const TOTAL_COL_WIDTH = 100;
const ROW_HEIGHT = 44;

type TabKey = 'mine' | 'all' | 'approvals';
type ViewMode = 'timesheet' | 'entries';
type MinutesByDay = Record<string, number[]>;

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatRange(start: Date): string {
  const end = addDays(start, 6);
  return `${MONTHS[start.getMonth()]} ${start.getDate()} - ${MONTHS[end.getMonth()]} ${end.getDate()}`;
}

/** Minutes → "h:mm" (e.g. 150 → "2:30"). Empty for 0. */
function formatMinutes(min: number): string {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function buildInitialMinutes(tasks: TimesheetTask[]): MinutesByDay {
  return Object.fromEntries(tasks.map((t) => [t.id, [...t.minutes]]));
}

export function TimesheetsPage() {
  const [tab, setTab] = useState<TabKey>('mine');
  const [view, setView] = useState<ViewMode>('timesheet');
  const [weekOffset, setWeekOffset] = useState(0);
  const [populated, setPopulated] = useState(false);
  const [minutes, setMinutes] = useState<MinutesByDay>(() => buildInitialMinutes(TIMESHEET_TASKS));

  const weekStart = useMemo(() => addDays(SEED_WEEK_START, weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const todayIndex = weekOffset === 0 ? SEED_TODAY_INDEX : -1;

  const showEmpty = tab !== 'mine' || !populated;

  return (
    <PageSurface>
      <HeaderBar tab={tab} onTab={setTab} />
      <Toolbar
        rangeLabel={formatRange(weekStart)}
        onPrev={() => setWeekOffset((w) => w - 1)}
        onNext={() => setWeekOffset((w) => w + 1)}
      />
      <FilterRow view={view} onView={setView} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px' }}>
        <div
          style={{
            minHeight: 360,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            background: APP_BG,
            display: showEmpty ? 'flex' : 'block',
            alignItems: showEmpty ? 'center' : undefined,
            justifyContent: showEmpty ? 'center' : undefined,
          }}
        >
          {showEmpty ? (
            <EmptyTimesheet onAllAssigned={() => setPopulated(true)} active={tab === 'mine'} />
          ) : (
            <Grid
              tasks={TIMESHEET_TASKS}
              days={days}
              minutes={minutes}
              onSetMinutes={(taskId, dayIndex, value) =>
                setMinutes((prev) => {
                  const next = [...(prev[taskId] ?? new Array(7).fill(0))];
                  next[dayIndex] = value;
                  return { ...prev, [taskId]: next };
                })
              }
              todayIndex={todayIndex}
            />
          )}
        </div>
      </div>
    </PageSurface>
  );
}

/* ───────────────────────── Header bar (title + tabs + Configure) ───────────────────────── */

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mine', label: 'My timesheet' },
  { key: 'all', label: 'All timesheets' },
  { key: 'approvals', label: 'Approvals' },
];

function HeaderBar({ tab, onTab }: { tab: TabKey; onTab: (t: TabKey) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 48,
        paddingLeft: 16,
        paddingRight: 16,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16 }}>
        <span style={{ display: 'inline-flex', color: TEXT_SECONDARY }}>
          <ClockIcon size={16} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>Timesheets</span>
      </div>

      <div style={{ width: 1, alignSelf: 'center', height: 20, background: BORDER }} />

      <nav style={{ display: 'flex', alignItems: 'stretch', marginLeft: 16, gap: 4 }}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? TEXT_PRIMARY : TEXT_MUTED,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = TEXT_SECONDARY;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = TEXT_MUTED;
              }}
            >
              {t.label}
              <span
                style={{
                  position: 'absolute',
                  left: 8,
                  right: 8,
                  bottom: 0,
                  height: 2,
                  borderRadius: 1,
                  background: active ? ACTIVE_LINE : 'transparent',
                }}
              />
            </button>
          );
        })}
      </nav>

      <span style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            padding: '0 10px',
            background: HOVER_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            color: TEXT_SECONDARY,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <SettingsIcon size={15} />
          Configure
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Toolbar (week navigator) ───────────────────────── */

function Toolbar({
  rangeLabel,
  onPrev,
  onNext,
}: {
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 48, padding: '0 18px' }}>
      <IconButton ariaLabel="Previous week" onClick={onPrev}>
        <ChevronLeft size={18} />
      </IconButton>
      <IconButton ariaLabel="Next week" onClick={onNext}>
        <ChevronRight size={18} />
      </IconButton>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 8px',
          marginLeft: 4,
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          color: TEXT_PRIMARY,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {rangeLabel}
        <span style={{ display: 'inline-flex', color: TEXT_MUTED }}>
          <ChevronDown size={16} />
        </span>
      </button>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        color: TEXT_SECONDARY,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── Filter row (pills + segmented toggle) ───────────────────────── */

function FilterRow({ view, onView }: { view: ViewMode; onView: (v: ViewMode) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 24px',
      }}
    >
      <FilterPill icon={<DollarIcon size={15} />} label="Billable status" />
      <FilterPill icon={<TagIcon size={15} />} label="Tag" />
      <FilterPill icon={<TrackedTimeIcon size={15} />} label="Tracked time" />

      <span style={{ flex: 1 }} />

      <Segmented view={view} onView={onView} />
    </div>
  );
}

function FilterPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 30,
        padding: '0 12px',
        background: 'transparent',
        border: `1px solid ${BORDER}`,
        borderRadius: 15,
        color: TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ display: 'inline-flex', color: TEXT_MUTED }}>{icon}</span>
      {label}
    </button>
  );
}

function Segmented({ view, onView }: { view: ViewMode; onView: (v: ViewMode) => void }) {
  const items: { key: ViewMode; label: string; icon: ReactNode }[] = [
    { key: 'timesheet', label: 'Timesheet', icon: <TimesheetViewIcon size={15} /> },
    { key: 'entries', label: 'Time entries', icon: <ListViewIcon size={15} /> },
  ];
  return (
    <div
      style={{
        display: 'flex',
        padding: 2,
        background: HOVER_BG,
        borderRadius: 8,
      }}
    >
      {items.map((it) => {
        const active = it.key === view;
        return (
          <button
            key={it.key}
            onClick={() => onView(it.key)}
            aria-pressed={active}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 12px',
              background: active ? APP_BG : 'transparent',
              border: 'none',
              borderRadius: 6,
              color: active ? TEXT_PRIMARY : TEXT_MUTED,
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
              transition: 'color 120ms',
            }}
          >
            <span style={{ display: 'inline-flex' }}>{it.icon}</span>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Empty state ───────────────────────── */

function EmptyTimesheet({ onAllAssigned, active }: { onAllAssigned: () => void; active: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px',
        width: '100%',
      }}
    >
      <StopwatchHero size={88} />
      <h2 style={{ margin: '20px 0 0', fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>
        Add entries to this week&rsquo;s timesheet
      </h2>

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 28,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <OptionCard
          icon={<UsersIcon size={22} />}
          label="All assigned tasks"
          onClick={active ? onAllAssigned : undefined}
        />
        <OptionCard icon={<CopyIcon size={22} />} label="Last week's tasks" disabled />
        <OptionCard icon={<PlusCircleIcon size={22} />} label="Individual tasks" />
        <OptionCard icon={<TimerIcon size={22} />} label="Track time" />
      </div>
    </div>
  );
}

function OptionCard({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: 176,
        height: 84,
        padding: 14,
        background: APP_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
        transition: 'border-color 120ms, background 120ms',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--cu-text-muted, rgb(180,180,180))';
        e.currentTarget.style.background = HOVER_BG;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = BORDER;
        e.currentTarget.style.background = APP_BG;
      }}
    >
      <span style={{ display: 'inline-flex', color: disabled ? TEXT_MUTED : TEXT_SECONDARY }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: disabled ? TEXT_MUTED : TEXT_PRIMARY }}>
        {label}
      </span>
    </button>
  );
}

/* ───────────────────────── Populated grid (revealed via "All assigned tasks") ───────────────────────── */

const cellBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: ROW_HEIGHT,
  borderRight: `1px solid ${GRID}`,
  boxSizing: 'border-box',
};

function Grid({
  tasks,
  days,
  minutes,
  onSetMinutes,
  todayIndex,
}: {
  tasks: TimesheetTask[];
  days: Date[];
  minutes: MinutesByDay;
  onSetMinutes: (taskId: string, dayIndex: number, value: number) => void;
  todayIndex: number;
}) {
  const gridTemplate = `${TASK_COL_WIDTH}px repeat(7, ${DAY_COL_WIDTH}px) ${TOTAL_COL_WIDTH}px`;

  const dayTotals = useMemo(() => {
    const totals = new Array(7).fill(0);
    for (const row of Object.values(minutes)) {
      for (let i = 0; i < 7; i++) totals[i] += row[i] ?? 0;
    }
    return totals;
  }, [minutes]);
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  return (
    <div style={{ minWidth: 'max-content' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          borderBottom: `1px solid ${GRID}`,
          background: HOVER_BG,
        }}
      >
        <HeaderCell left>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY }}>Task</span>
        </HeaderCell>
        {days.map((d, i) => (
          <HeaderCell key={i} center highlight={i === todayIndex}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.25 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED }}>{WEEKDAY_LABELS[i]}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{d.getDate()}</span>
            </div>
          </HeaderCell>
        ))}
        <HeaderCell center>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY }}>Total</span>
        </HeaderCell>
      </div>

      {tasks.map((task) => {
        const row = minutes[task.id] ?? new Array(7).fill(0);
        const rowTotal = row.reduce((a: number, b: number) => a + b, 0);
        return (
          <div
            key={task.id}
            style={{ display: 'grid', gridTemplateColumns: gridTemplate, borderBottom: `1px solid ${GRID}` }}
          >
            <TaskCell task={task} />
            {row.map((min: number, i: number) => (
              <TimeCell
                key={i}
                minutes={min}
                highlight={i === todayIndex}
                onCommit={(value) => onSetMinutes(task.id, i, value)}
              />
            ))}
            <div
              style={{
                ...cellBase,
                justifyContent: 'flex-end',
                paddingRight: 16,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 13,
                fontWeight: 600,
                color: rowTotal ? TEXT_PRIMARY : TEXT_MUTED,
              }}
            >
              {rowTotal ? formatMinutes(rowTotal) : '–'}
            </div>
          </div>
        );
      })}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          borderBottom: `1px solid ${GRID}`,
          background: HOVER_BG,
        }}
      >
        <div style={{ ...cellBase, paddingLeft: 16, fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY }}>
          Daily total
        </div>
        {dayTotals.map((min, i) => (
          <div
            key={i}
            style={{
              ...cellBase,
              justifyContent: 'center',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 13,
              fontWeight: 600,
              color: min ? TEXT_PRIMARY : TEXT_MUTED,
            }}
          >
            {min ? formatMinutes(min) : '–'}
          </div>
        ))}
        <div
          style={{
            ...cellBase,
            justifyContent: 'flex-end',
            paddingRight: 16,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 13,
            fontWeight: 700,
            color: TEXT_PRIMARY,
          }}
        >
          {formatMinutes(weekTotal)}
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
  children,
  center,
  left,
  highlight,
}: {
  children: ReactNode;
  center?: boolean;
  left?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: center ? 'center' : 'flex-start',
        height: 40,
        paddingLeft: left ? 16 : 0,
        borderRight: `1px solid ${GRID}`,
        boxSizing: 'border-box',
        background: highlight ? 'rgba(34,113,177,0.06)' : undefined,
      }}
    >
      {children}
    </div>
  );
}

function TaskCell({ task }: { task: TimesheetTask }) {
  return (
    <div
      style={{
        ...cellBase,
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 2,
        paddingLeft: 16,
        paddingRight: 12,
        background: APP_BG,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{ width: 8, height: 8, borderRadius: 2, background: task.color, flexShrink: 0 }}
          aria-hidden="true"
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY }}>{task.name}</span>
      </div>
      <span style={{ fontSize: 11, color: TEXT_MUTED, paddingLeft: 16 }}>{task.breadcrumb}</span>
    </div>
  );
}

function parseTimeInput(raw: string): number | null {
  const value = raw.trim();
  if (!value) return 0;
  if (value.includes(':')) {
    const [hPart, mPart] = value.split(':');
    const h = Number(hPart);
    const m = Number(mPart);
    if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m >= 60) return null;
    return Math.max(0, Math.round(h) * 60 + Math.round(m));
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 60);
}

function TimeCell({
  minutes,
  highlight,
  onCommit,
}: {
  minutes: number;
  highlight: boolean;
  onCommit: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(formatMinutes(minutes));
    setError(false);
    setEditing(true);
  }

  function commit() {
    const parsed = parseTimeInput(draft);
    if (parsed === null) {
      setError(true);
      return;
    }
    onCommit(parsed);
    setEditing(false);
  }

  const display = formatMinutes(minutes);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !editing && startEdit()}
      style={{
        ...cellBase,
        justifyContent: 'center',
        cursor: 'text',
        background: highlight ? 'rgba(34,113,177,0.05)' : hovered ? HOVER_BG : undefined,
        transition: 'background 120ms',
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="h:mm"
          style={{
            width: 54,
            height: 26,
            textAlign: 'center',
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            color: TEXT_PRIMARY,
            background: 'var(--cu-bg-input, rgb(255,255,255))',
            border: `1.5px solid ${error ? 'rgb(199,67,67)' : 'rgb(34,113,177)'}`,
            borderRadius: 5,
            outline: 'none',
          }}
        />
      ) : (
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: TEXT_PRIMARY }}>{display}</span>
      )}
    </div>
  );
}
