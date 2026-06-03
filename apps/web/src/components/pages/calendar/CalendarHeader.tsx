'use client';

/**
 * Calendar period-nav cluster: Today · period dropdown (Day/Week/Month) ·
 * prev/next arrows · period label. In real ClickUp this sits on the LEFT of the
 * single calendar toolbar row (the working Filter / Closed / Assignee / Search /
 * Customize / Add-Task controls render to the right via the shared
 * `<ViewToolbar>`). This cluster owns only calendar date navigation.
 *
 * The period selector is the real ClickUp `view-time-period-dropdown`: a button
 * showing the current period with a caret, opening a Day/Week/Month menu with
 * d/w/m hotkey badges. No decorative controls — every item flips the view type.
 */

import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from '@/components/ui/Icons';
import { Menu, MenuHeading, MenuItem } from '@/components/ui/Menu';
import { CAL } from './tokens';
import type { CalendarViewType } from './calendar-state';

interface CalendarMonthNavProps {
  periodLabel: string;
  viewType: CalendarViewType;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewType: (type: CalendarViewType) => void;
}

const PERIOD_OPTIONS: { type: CalendarViewType; label: string; hotkey: string }[] = [
  { type: 'day', label: 'Day', hotkey: 'd' },
  { type: '4days', label: '4 days', hotkey: '4' },
  { type: 'week', label: 'Week', hotkey: 'w' },
  { type: 'month', label: 'Month', hotkey: 'm' },
];

const PERIOD_LABEL: Record<CalendarViewType, string> = {
  day: 'Day',
  '4days': '4 days',
  week: 'Week',
  month: 'Month',
};

export function CalendarMonthNav({
  periodLabel,
  viewType,
  onPrev,
  onNext,
  onToday,
  onViewType,
}: CalendarMonthNavProps) {
  return (
    <div
      data-testid="calendar-month-nav"
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <ToolbarButton onClick={onToday} testid="calendar-today">
        Today
      </ToolbarButton>

      <PeriodDropdown viewType={viewType} onViewType={onViewType} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <NavArrow direction="prev" onClick={onPrev} />
        <NavArrow direction="next" onClick={onNext} />
      </div>

      <span
        data-testid="calendar-period-label"
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: CAL.textSecondary,
          marginLeft: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {periodLabel}
      </span>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  testid,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  testid?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 10px',
        background: hover ? CAL.hoverBg : 'transparent',
        border: `1px solid ${CAL.gridBorder}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: CAL.textSecondary,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}

function PeriodDropdown({
  viewType,
  onViewType,
}: {
  viewType: CalendarViewType;
  onViewType: (type: CalendarViewType) => void;
}) {
  return (
    <Menu
      width={160}
      trigger={({ ref, onClick, open }) => (
        <button
          ref={ref}
          type="button"
          data-testid="calendar-period-dropdown"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Time period"
          onClick={onClick}
          onMouseEnter={(e) => {
            if (!open) e.currentTarget.style.background = CAL.hoverBg;
          }}
          onMouseLeave={(e) => {
            if (!open) e.currentTarget.style.background = 'transparent';
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            height: 28,
            padding: '0 8px 0 10px',
            background: open ? CAL.hoverBg : 'transparent',
            border: `1px solid ${CAL.gridBorder}`,
            borderRadius: 6,
            cursor: 'pointer',
            color: CAL.textSecondary,
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {PERIOD_LABEL[viewType]}
          <ChevronDownIcon size={14} />
        </button>
      )}
    >
      <MenuHeading>Time period</MenuHeading>
      {PERIOD_OPTIONS.map((opt) => (
        <MenuItem
          key={opt.type}
          label={opt.label}
          active={opt.type === viewType}
          postscript={<HotkeyBadge hotkey={opt.hotkey} />}
          onSelect={() => onViewType(opt.type)}
        />
      ))}
    </Menu>
  );
}

function HotkeyBadge({ hotkey }: { hotkey: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        borderRadius: 4,
        border: `1px solid ${CAL.gridBorder}`,
        background: CAL.inputBg,
        color: CAL.textMuted,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
      }}
    >
      {hotkey}
    </span>
  );
}

function NavArrow({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid={`calendar-${direction}`}
      aria-label={direction === 'prev' ? 'Previous' : 'Next'}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 6,
        background: hover ? CAL.hoverBg : 'transparent',
        color: CAL.textSecondary,
        cursor: 'pointer',
        transition: 'background 120ms',
      }}
    >
      {direction === 'prev' ? <ChevronLeftIcon size={16} /> : <ChevronRightIcon size={16} />}
    </button>
  );
}
