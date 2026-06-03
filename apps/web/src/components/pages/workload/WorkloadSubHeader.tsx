'use client';

/**
 * Workload sub-header: a left controls cluster pinned over the lane-label column
 * (week-range stepper "May 31 – Jun 6  < >", a show/hide eye, a capacity happy-
 * face), then the scrollable day-column header (S 31 / M 1 / T 2[today] / …) with
 * weekend columns hatched and the ANCHOR_NOW day flagged red.
 *
 * The day header shares the horizontal scroll container with the grid body, so it
 * is rendered as the grid's first row in `WorkloadGrid`; this component owns only
 * the sticky LEFT controls block. The day-tick strip lives in `DayTickRow`.
 */

import { useState } from 'react';
import { WL } from './tokens';
import { monthSegments, type Day } from './periods';

function CaretIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepIcon({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth={1.6} />
      {off && <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />}
    </svg>
  );
}

function HappyFaceIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.6} />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M8.5 14.5a4 4 0 007 0" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function IconToggle({
  label,
  testid,
  active,
  onClick,
  children,
}: {
  label: string;
  testid: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      data-testid={testid}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover || active ? WL.hover : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? WL.textPrimary : WL.textSecondary,
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}

export function SubHeaderControls({
  rangeLabel,
  onToday,
  onPrev,
  onNext,
  showEmpty,
  onToggleEmpty,
  capacityOn,
  onToggleCapacity,
}: {
  rangeLabel: string;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  showEmpty: boolean;
  onToggleEmpty: () => void;
  capacityOn: boolean;
  onToggleCapacity: () => void;
}) {
  const [rangeHover, setRangeHover] = useState(false);
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        padding: '0 12px',
      }}
    >
      {/* Row 1 — range "May 31 – Jun 6 ⌄" + week stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          data-testid="workload-range-label"
          aria-haspopup="menu"
          title="Jump to today"
          onClick={onToday}
          onMouseEnter={() => setRangeHover(true)}
          onMouseLeave={() => setRangeHover(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            height: 26,
            padding: '0 8px',
            background: rangeHover ? WL.hover : 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            color: WL.textPrimary,
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
            transition: 'background 120ms',
          }}
        >
          {rangeLabel}
          <CaretIcon />
        </button>
        <div style={{ display: 'flex' }}>
          <IconToggle label="Previous" testid="workload-range-prev" onClick={onPrev}>
            <StepIcon dir="prev" />
          </IconToggle>
          <IconToggle label="Next" testid="workload-range-next" onClick={onNext}>
            <StepIcon dir="next" />
          </IconToggle>
        </div>
      </div>
      {/* Row 2 — show/hide eye + capacity face (right-aligned) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <span style={{ flex: 1 }} />
        <IconToggle
          label={showEmpty ? 'Hide people with no scheduled tasks' : 'Show people with no scheduled tasks'}
          testid="workload-eye"
          active={!showEmpty}
          onClick={onToggleEmpty}
        >
          <EyeIcon off={!showEmpty} />
        </IconToggle>
        <IconToggle
          label="Toggle capacity guide"
          testid="workload-capacity"
          active={capacityOn}
          onClick={onToggleCapacity}
        >
          <HappyFaceIcon />
        </IconToggle>
      </div>
    </div>
  );
}

/** The month-name strip that sits above the day ticks ("May 2026   June"). */
export function MonthStrip({ days, colWidth }: { days: Day[]; colWidth: number }) {
  const segments = monthSegments(days);
  return (
    <div
      style={{
        display: 'flex',
        height: WL.monthStripHeight,
        background: WL.bg,
      }}
    >
      {segments.map((seg) => (
        <div
          key={seg.label}
          style={{
            width: seg.span * colWidth,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontSize: 13,
            fontWeight: 600,
            color: WL.textPrimary,
            whiteSpace: 'nowrap',
          }}
        >
          {seg.label}
        </div>
      ))}
    </div>
  );
}

/** The scrollable header: month strip stacked over the day-tick strip. */
export function DayTickRow({ days, colWidth }: { days: Day[]; colWidth: number }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        background: WL.bg,
        borderBottom: `1px solid ${WL.gridBorderStrong}`,
      }}
    >
      <MonthStrip days={days} colWidth={colWidth} />
      <div style={{ display: 'flex', height: WL.dayTickHeight }}>
        {days.map((day) => (
          <div
            key={day.start}
            style={{
              width: colWidth,
              flexShrink: 0,
              borderRight: `1px solid ${WL.gridBorder}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: day.isToday
                ? WL.todayTint
                : day.isWeekend
                  ? WL.weekendHatch
                  : 'transparent',
            }}
          >
          <span
            style={{
              fontSize: 11,
              fontWeight: day.isToday ? 700 : 600,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
              color: day.isToday ? WL.textPrimary : WL.textMuted,
            }}
          >
            {day.dow}
          </span>
          {day.isToday ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 22,
                height: 22,
                padding: '0 5px',
                borderRadius: WL.radiusFull,
                background: WL.todayLine,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {day.dom}
            </span>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 700, color: WL.textPrimary }}>
              {day.dom}
            </span>
          )}
          </div>
        ))}
      </div>
    </div>
  );
}
