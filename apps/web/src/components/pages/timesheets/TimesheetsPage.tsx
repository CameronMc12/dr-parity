'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  PageSurface,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  BORDER,
  HOVER_BG,
  APP_BG,
  DARK_BTN,
} from '../page-primitives';
import {
  TIMESHEET_TASKS,
  TIMESHEET_PEOPLE,
  WEEKDAY_LABELS,
  SEED_WEEK_START,
  type TimesheetTask,
  type TimesheetPerson,
} from '../../../data/timesheets-seed';
import {
  ChevronLeft,
  ChevronRight,
  PlayIcon,
  StopIcon,
  ClockIcon,
  PlusTiny,
} from './timesheet-icons';

/** Solid spreadsheet gridline (slightly stronger than the soft page divider). */
const GRID = 'var(--cu-border-divider, rgb(232, 232, 232))';
const TASK_COL_WIDTH = 280;
const DAY_COL_WIDTH = 96;
const TOTAL_COL_WIDTH = 104;
const ROW_HEIGHT = 44;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type MinutesByDay = Record<string, number[]>;

function buildInitialMinutes(tasks: TimesheetTask[]): MinutesByDay {
  return Object.fromEntries(tasks.map((t) => [t.id, [...t.minutes]]));
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatRange(start: Date): string {
  const end = addDays(start, 6);
  const left = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const right = `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${left} - ${right}`;
}

/** Minutes → "h:mm" (e.g. 150 → "2:30"). Empty for 0. */
function formatMinutes(min: number): string {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Minutes → "32h 15m" header style. */
function formatLong(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Parse "h:mm", "h", or bare minutes into total minutes. Invalid → null. */
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

function ticksToClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

const DEFAULT_PERSON: TimesheetPerson = TIMESHEET_PEOPLE[0] ?? {
  id: 'u-self',
  name: 'You',
  initials: 'YO',
  avatarColor: 'rgb(34, 113, 177)',
};

export function TimesheetsPage() {
  const [person, setPerson] = useState<TimesheetPerson>(DEFAULT_PERSON);
  const [weekOffset, setWeekOffset] = useState(0);
  const [minutes, setMinutes] = useState<MinutesByDay>(() => buildInitialMinutes(TIMESHEET_TASKS));

  const weekStart = useMemo(() => addDays(SEED_WEEK_START, weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const todayIndex = weekOffset === 0 ? 2 : -1; // demo "today" sits on the seeded week's Wed.

  const dayTotals = useMemo(() => {
    const totals = new Array(7).fill(0);
    for (const row of Object.values(minutes)) {
      for (let i = 0; i < 7; i++) totals[i] += row[i] ?? 0;
    }
    return totals;
  }, [minutes]);

  const weekTotal = useMemo(() => dayTotals.reduce((a, b) => a + b, 0), [dayTotals]);

  return (
    <PageSurface>
      <Header
        person={person}
        people={TIMESHEET_PEOPLE}
        onPickPerson={setPerson}
        rangeLabel={formatRange(weekStart)}
        onPrev={() => setWeekOffset((w) => w - 1)}
        onNext={() => setWeekOffset((w) => w + 1)}
        onToday={() => setWeekOffset(0)}
        isToday={weekOffset === 0}
        weekTotal={weekTotal}
      />
      <SubBar weekTotal={weekTotal} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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
          dayTotals={dayTotals}
          weekTotal={weekTotal}
          todayIndex={todayIndex}
        />
      </div>
    </PageSurface>
  );
}

/* ───────────────────────── Header ───────────────────────── */

function Header({
  person,
  people,
  onPickPerson,
  rangeLabel,
  onPrev,
  onNext,
  onToday,
  isToday,
  weekTotal,
}: {
  person: TimesheetPerson;
  people: TimesheetPerson[];
  onPickPerson: (p: TimesheetPerson) => void;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isToday: boolean;
  weekTotal: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 16,
        paddingBottom: 12,
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>Timesheets</h1>

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 32,
            paddingLeft: 6,
            paddingRight: 12,
            background: 'transparent',
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            cursor: 'pointer',
          }}
        >
          <Avatar person={person} size={22} />
          <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY }}>{person.name}</span>
        </button>
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 38,
              left: 0,
              zIndex: 20,
              minWidth: 220,
              background: APP_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
              padding: 6,
            }}
          >
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onPickPerson(p);
                  setMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '7px 8px',
                  background: p.id === person.id ? HOVER_BG : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = p.id === person.id ? HOVER_BG : 'transparent')
                }
              >
                <Avatar person={p} size={24} />
                <span style={{ fontSize: 13, color: TEXT_PRIMARY }}>{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <WeekNav rangeLabel={rangeLabel} onPrev={onPrev} onNext={onNext} onToday={onToday} isToday={isToday} />

      <span style={{ flex: 1 }} />

      <Timer />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
        <span style={{ fontSize: 11, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Total
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY }}>{formatLong(weekTotal)}</span>
      </div>

      <button
        style={{
          height: 36,
          paddingLeft: 18,
          paddingRight: 18,
          background: DARK_BTN,
          border: 'none',
          borderRadius: 8,
          color: APP_BG,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 120ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        Submit
      </button>
    </div>
  );
}

function WeekNav({
  rangeLabel,
  onPrev,
  onNext,
  onToday,
  isToday,
}: {
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isToday: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <NavIconButton onClick={onPrev} ariaLabel="Previous week">
        <ChevronLeft />
      </NavIconButton>
      <span
        style={{
          minWidth: 120,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 600,
          color: TEXT_PRIMARY,
        }}
      >
        {rangeLabel}
      </span>
      <NavIconButton onClick={onNext} ariaLabel="Next week">
        <ChevronRight />
      </NavIconButton>
      <button
        onClick={onToday}
        disabled={isToday}
        style={{
          marginLeft: 6,
          height: 28,
          paddingLeft: 12,
          paddingRight: 12,
          background: 'transparent',
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
          color: isToday ? TEXT_MUTED : TEXT_SECONDARY,
          fontSize: 12,
          fontWeight: 600,
          cursor: isToday ? 'default' : 'pointer',
          opacity: isToday ? 0.6 : 1,
        }}
      >
        Today
      </button>
    </div>
  );
}

function NavIconButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
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
        width: 28,
        height: 28,
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

/* ───────────────────────── Timer ───────────────────────── */

function Timer() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 36,
        paddingLeft: 10,
        paddingRight: 4,
        background: running ? 'rgba(34,113,177,0.08)' : 'transparent',
        border: `1px solid ${running ? 'rgba(34,113,177,0.4)' : BORDER}`,
        borderRadius: 8,
      }}
    >
      <ClockIcon />
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: 14,
          fontWeight: 600,
          color: running ? 'rgb(34,113,177)' : TEXT_SECONDARY,
          minWidth: 72,
        }}
      >
        {ticksToClock(seconds)}
      </span>
      <button
        onClick={() => setRunning((r) => !r)}
        aria-label={running ? 'Stop timer' : 'Start timer'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          background: running ? 'rgb(199,67,67)' : 'rgb(34,113,177)',
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        {running ? <StopIcon /> : <PlayIcon />}
      </button>
    </div>
  );
}

/* ───────────────────────── SubBar ───────────────────────── */

function SubBar({ weekTotal }: { weekTotal: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 12,
      }}
    >
      <span style={{ fontSize: 12, color: TEXT_MUTED }}>
        {TIMESHEET_TASKS.length} tasks · {formatLong(weekTotal)} tracked this week
      </span>
    </div>
  );
}

/* ───────────────────────── Grid ───────────────────────── */

function Grid({
  tasks,
  days,
  minutes,
  onSetMinutes,
  dayTotals,
  weekTotal,
  todayIndex,
}: {
  tasks: TimesheetTask[];
  days: Date[];
  minutes: MinutesByDay;
  onSetMinutes: (taskId: string, dayIndex: number, value: number) => void;
  dayTotals: number[];
  weekTotal: number;
  todayIndex: number;
}) {
  const gridTemplate = `${TASK_COL_WIDTH}px repeat(7, ${DAY_COL_WIDTH}px) ${TOTAL_COL_WIDTH}px`;

  return (
    <div style={{ minWidth: 'max-content' }}>
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: APP_BG,
          borderTop: `1px solid ${GRID}`,
          borderBottom: `1px solid ${GRID}`,
        }}
      >
        <HeaderCell sticky left>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY }}>Task</span>
        </HeaderCell>
        {days.map((d, i) => (
          <HeaderCell key={i} highlight={i === todayIndex} center>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.25 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: i === todayIndex ? 'rgb(34,113,177)' : TEXT_MUTED }}>
                {WEEKDAY_LABELS[i]}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: i === todayIndex ? 'rgb(34,113,177)' : TEXT_PRIMARY }}>
                {d.getDate()}
              </span>
            </div>
          </HeaderCell>
        ))}
        <HeaderCell center>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY }}>Total</span>
        </HeaderCell>
      </div>

      {/* Task rows */}
      {tasks.map((task) => {
        const row = minutes[task.id] ?? new Array(7).fill(0);
        const rowTotal = row.reduce((a, b) => a + b, 0);
        return (
          <div
            key={task.id}
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              borderBottom: `1px solid ${GRID}`,
            }}
          >
            <TaskCell task={task} />
            {row.map((min, i) => (
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

      {/* Totals row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          borderBottom: `1px solid ${GRID}`,
          background: 'var(--cu-bg-hover, rgb(248,248,248))',
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
              background: i === todayIndex ? 'rgba(34,113,177,0.06)' : undefined,
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

const cellBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: ROW_HEIGHT,
  borderRight: `1px solid ${GRID}`,
  boxSizing: 'border-box',
};

function HeaderCell({
  children,
  center,
  left,
  sticky,
  highlight,
}: {
  children: React.ReactNode;
  center?: boolean;
  left?: boolean;
  sticky?: boolean;
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
        background: highlight ? 'rgba(34,113,177,0.06)' : sticky ? APP_BG : undefined,
        position: sticky ? 'sticky' : undefined,
        left: sticky ? 0 : undefined,
        zIndex: sticky ? 1 : undefined,
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
        position: 'sticky',
        left: 0,
        zIndex: 1,
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
            width: 56,
            height: 26,
            textAlign: 'center',
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            color: TEXT_PRIMARY,
            background: APP_BG,
            border: `1.5px solid ${error ? 'rgb(199,67,67)' : 'rgb(34,113,177)'}`,
            borderRadius: 5,
            outline: 'none',
          }}
        />
      ) : display ? (
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: TEXT_PRIMARY }}>{display}</span>
      ) : (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: TEXT_MUTED,
            opacity: hovered ? 0.7 : 0,
            transition: 'opacity 120ms',
          }}
          aria-hidden="true"
        >
          <PlusTiny />
        </span>
      )}
    </div>
  );
}

/* ───────────────────────── Avatar ───────────────────────── */

function Avatar({ person, size }: { person: TimesheetPerson; size: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: person.avatarColor,
        color: '#fff',
        fontSize: size * 0.42,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {person.initials}
    </span>
  );
}
