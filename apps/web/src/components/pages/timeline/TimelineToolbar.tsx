'use client';

/**
 * Timeline-specific controls strip. Sits directly under the shared ViewToolbar,
 * matching ClickUp's Timeline sub-toolbar.
 *
 * LEFT  : Today jump | time-period dropdown (Days / Weeks / Months) |
 *         swimlane Group dropdown (None / Status / Assignee / Priority).
 * RIGHT : Tasks-panel toggle.
 *
 * The +/- zoom stepper is exported and floated over the chart's top-right by
 * TimelineView, matching ClickUp's zoom controls sitting on the canvas rather
 * than in the toolbar strip.
 *
 * Every dropdown uses the shared `@/components/ui/Menu` primitive so it gets the
 * same popover styling, outside-click and Escape handling as the rest of the app.
 * Group here is the Timeline's own swimlane axis (None = one flat track) and is
 * independent of the shared toolbar's task grouping.
 */

import { useState } from 'react';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { CaretDown, GroupIcon } from '@/components/pages/list-view-icons';
import {
  GROUP_BY_LABEL,
  GROUP_BY_ORDER,
  TL,
  ZOOM_LABEL,
  ZOOM_ORDER,
  type TimelineGroupBy,
  type TimelineZoom,
} from './tokens';

function btnStyle(active: boolean, hover: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    padding: '0 10px',
    background: active || hover ? TL.hover : 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: active ? TL.textPrimary : TL.textSecondary,
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    transition: 'background 120ms',
  };
}

function CheckGlyph() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Time-period (granularity) dropdown: Days / Weeks / Months. */
function TimePeriodDropdown({
  zoom,
  onZoom,
}: {
  zoom: TimelineZoom;
  onZoom: (z: TimelineZoom) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Menu
      width={160}
      align="left"
      trigger={({ ref, onClick, open }) => (
        <button
          ref={ref}
          type="button"
          data-testid="timeline-time-period-dropdown-toggle"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Timeline time period"
          onClick={onClick}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            ...btnStyle(open, hover),
            border: `1px solid ${TL.gridBorder}`,
          }}
        >
          {ZOOM_LABEL[zoom]}
          <CaretDown />
        </button>
      )}
    >
      {ZOOM_ORDER.map((opt) => (
        <MenuItem
          key={opt}
          label={ZOOM_LABEL[opt]}
          active={opt === zoom}
          postscript={opt === zoom ? <CheckGlyph /> : undefined}
          onSelect={() => onZoom(opt)}
        />
      ))}
    </Menu>
  );
}

/** Swimlane grouping dropdown: None / Status / Assignee / Priority. */
function GroupDropdown({
  groupBy,
  onGroupBy,
}: {
  groupBy: TimelineGroupBy;
  onGroupBy: (g: TimelineGroupBy) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Menu
      width={180}
      align="left"
      trigger={({ ref, onClick, open }) => (
        <button
          ref={ref}
          type="button"
          data-testid="timeline-groupby"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Group timeline lanes"
          onClick={onClick}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={btnStyle(open, hover)}
        >
          <GroupIcon />
          <span style={{ opacity: 0.7 }}>Group:</span> {GROUP_BY_LABEL[groupBy]}
          <CaretDown />
        </button>
      )}
    >
      {GROUP_BY_ORDER.map((opt) => (
        <MenuItem
          key={opt}
          label={GROUP_BY_LABEL[opt]}
          active={opt === groupBy}
          postscript={opt === groupBy ? <CheckGlyph /> : undefined}
          onSelect={() => onGroupBy(opt)}
        />
      ))}
    </Menu>
  );
}

export function ZoomStepper({
  zoom,
  onZoom,
}: {
  zoom: TimelineZoom;
  onZoom: (z: TimelineZoom) => void;
}) {
  const idx = ZOOM_ORDER.indexOf(zoom);
  const zoomIn = () => onZoom(ZOOM_ORDER[Math.max(0, idx - 1)]!);
  const zoomOut = () => onZoom(ZOOM_ORDER[Math.min(ZOOM_ORDER.length - 1, idx + 1)]!);

  return (
    <div
      role="group"
      aria-label="Zoom"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--cu-bg-menu, #1f1f1f)',
        border: `1px solid ${TL.gridBorder}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
      }}
    >
      <StepButton
        glyph="+"
        label="Zoom in"
        testid="timeline-zoom-in"
        disabled={idx <= 0}
        onClick={zoomIn}
      />
      <div style={{ height: 1, background: TL.gridBorder }} />
      <StepButton
        glyph="−"
        label="Zoom out"
        testid="timeline-zoom-out"
        disabled={idx >= ZOOM_ORDER.length - 1}
        onClick={zoomOut}
      />
    </div>
  );
}

function StepButton({
  glyph,
  label,
  testid,
  disabled,
  onClick,
}: {
  glyph: string;
  label: string;
  testid: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: !disabled && hover ? TL.hover : 'transparent',
        color: disabled ? TL.textMuted : TL.textSecondary,
        fontSize: 17,
        lineHeight: 1,
        fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 120ms',
      }}
    >
      {glyph}
    </button>
  );
}

function TasksPanelButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="timeline-tasks-panel-toggle"
      aria-pressed={active}
      aria-label="Toggle tasks panel"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...btnStyle(active, hover),
        border: `1px solid ${active ? TL.gridBorderStrong : TL.gridBorder}`,
      }}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 7h16M4 12h16M4 17h10"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </svg>
      Tasks
    </button>
  );
}

function TodayButton({ onToday }: { onToday: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="timeline-today"
      aria-label="Scroll to today"
      onClick={onToday}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...btnStyle(false, hover),
        border: `1px solid ${TL.gridBorder}`,
      }}
    >
      Today
    </button>
  );
}

export function TimelineToolbar({
  groupBy,
  onGroupBy,
  zoom,
  onZoom,
  onToday,
  panelOpen,
  onTogglePanel,
}: {
  groupBy: TimelineGroupBy;
  onGroupBy: (g: TimelineGroupBy) => void;
  zoom: TimelineZoom;
  onZoom: (z: TimelineZoom) => void;
  onToday: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 16px',
        borderBottom: `1px solid ${TL.gridBorder}`,
        background: TL.bg,
        flexShrink: 0,
      }}
    >
      <TodayButton onToday={onToday} />
      <TimePeriodDropdown zoom={zoom} onZoom={onZoom} />
      <GroupDropdown groupBy={groupBy} onGroupBy={onGroupBy} />
      <div style={{ flex: 1 }} />
      <TasksPanelButton active={panelOpen} onToggle={onTogglePanel} />
    </div>
  );
}
