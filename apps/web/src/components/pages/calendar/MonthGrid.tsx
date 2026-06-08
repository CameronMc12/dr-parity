'use client';

/**
 * Continuously-scrolling month view. Instead of a single 6×7 grid, this renders
 * a vertical STACK of consecutive month blocks and lazily extends the window in
 * either direction as the user scrolls toward an edge (spanning many years).
 *
 * - Infinite scroll: IntersectionObserver sentinels at the top and bottom of the
 *   stack prepend / append months. When prepending we compensate scrollTop by the
 *   height the new blocks added, so the viewport stays visually anchored (no jump).
 * - Today / prev / next: the toolbar emits a `scrollTarget` (month + nonce); this
 *   grid ensures that month is in the window then scrolls its block into view.
 * - Drag-to-reschedule works across every month: any DayCell in any block is a
 *   drop target (handled by DayCell + calendar actions).
 *
 * Chip placement is scoped per-block and memoized, so the stack stays smooth.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ANCHOR_NOW, type Task, startOfDay } from '@/lib/view-data';
import { CAL } from './tokens';
import { WeekdayHeader } from './WeekdayHeader';
import { MonthBlock } from './MonthBlock';
import { DayPopover } from './DayPopover';
import { chipsPerCell, type DayChip } from './chip-layout';
import {
  buildMonthWindow,
  extendBackward,
  extendForward,
  monthKey as toMonthKey,
} from './month-blocks';
import type { CalendarActions } from './use-calendar-actions';
import type { ScrollTarget } from './calendar-state';

interface MonthGridProps {
  tasks: Task[];
  scrollTarget: ScrollTarget;
  actions: CalendarActions;
  onChipContextMenu: (e: React.MouseEvent, task: Task) => void;
}

interface PopoverState {
  dayMs: number;
  chips: DayChip[];
  anchor: { x: number; y: number };
}

const TODAY = startOfDay(ANCHOR_NOW);
const INITIAL_BUFFER = 4; // months loaded each side of the centre on mount
const EXTEND_BY = 6; // months added per infinite-load step
const MAX_MONTHS = 720; // ±~30 years guard so the window never grows unbounded

// Month blocks render at a natural height (cells are min-height rows, not
// stretched to fill), so the chip cap is fixed off the min cell height.
const MONTH_CAP = chipsPerCell(CAL.cellMinHeight, CAL.chipHeight, CAL.chipGap, 30);

export function MonthGrid({ tasks, scrollTarget, actions, onChipContextMenu }: MonthGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const bottomSentinel = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  // Ordered window of month keys (1st-of-month local-midnight timestamps).
  const [monthKeys, setMonthKeys] = useState<number[]>(() =>
    buildMonthWindow(toMonthKey(scrollTarget.monthMs), INITIAL_BUFFER, INITIAL_BUFFER),
  );

  // When prepending, remember how much height we added so the next layout pass
  // can compensate scrollTop and keep the viewport anchored.
  const pendingPrependAnchor = useRef<{ topKey: number; prevTop: number } | null>(null);
  // A month key we want to scroll to the top of (Today / prev / next request),
  // consumed once the block is present in the DOM. Seeded with the initial
  // centre month so the very first layout pass scrolls the stack to the current
  // month instead of leaving it parked on the earliest buffered block.
  const pendingScrollKey = useRef<number | null>(toMonthKey(scrollTarget.monthMs));

  const scrollToPending = useCallback(() => {
    const key = pendingScrollKey.current;
    const el = scrollRef.current;
    if (key === null || !el) return;
    const block = el.querySelector<HTMLElement>(`[data-month="${key}"]`);
    if (block) {
      el.scrollTop = block.offsetTop;
      pendingScrollKey.current = null;
    }
  }, []);

  const closePopover = useCallback(() => setPopover(null), []);
  const onShowMore = useCallback(
    (dayMs: number, point: { x: number; y: number }, chips: DayChip[]) => {
      setPopover({ dayMs, chips, anchor: point });
    },
    [],
  );

  const loadEarlier = useCallback(() => {
    setMonthKeys((prev) => {
      if (prev.length >= MAX_MONTHS) return prev;
      const first = prev[0];
      if (first !== undefined) {
        const el = scrollRef.current;
        pendingPrependAnchor.current = el
          ? { topKey: first, prevTop: el.scrollTop }
          : null;
      }
      return extendBackward(prev, EXTEND_BY);
    });
  }, []);

  const loadLater = useCallback(() => {
    setMonthKeys((prev) => (prev.length >= MAX_MONTHS ? prev : extendForward(prev, EXTEND_BY)));
  }, []);

  // After a prepend, keep the previously-top block visually anchored: it now sits
  // lower by the height of the inserted months, so set scrollTop to its NEW
  // offsetTop plus however far we had scrolled past its OLD top (prevTop).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const anchor = pendingPrependAnchor.current;
    if (anchor) {
      pendingPrependAnchor.current = null;
      const target = el.querySelector<HTMLElement>(`[data-month="${anchor.topKey}"]`);
      if (target) el.scrollTop = target.offsetTop + anchor.prevTop;
    }
    // A freshly-inserted window may now contain the month we were asked to jump to.
    scrollToPending();
  }, [monthKeys, scrollToPending]);

  // Infinite-load sentinels.
  useEffect(() => {
    const root = scrollRef.current;
    const top = topSentinel.current;
    const bottom = bottomSentinel.current;
    if (!root || !top || !bottom || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === top) loadEarlier();
          else if (entry.target === bottom) loadLater();
        }
      },
      { root, rootMargin: '600px 0px' },
    );
    io.observe(top);
    io.observe(bottom);
    return () => io.disconnect();
  }, [loadEarlier, loadLater]);

  // Scroll-to-month on toolbar request (Today / prev / next). Record the target,
  // make sure it is in the window (rebuild around it if it fell outside), then let
  // the layout effect scroll once the block is committed. The first nonce (mount)
  // is skipped so we do not fight the initial position.
  const firstNonce = useRef(scrollTarget.nonce);
  useEffect(() => {
    if (scrollTarget.nonce === firstNonce.current) return;
    const key = toMonthKey(scrollTarget.monthMs);
    pendingScrollKey.current = key;
    setMonthKeys((prev) => {
      if (prev.includes(key)) return prev;
      return buildMonthWindow(key, INITIAL_BUFFER, INITIAL_BUFFER);
    });
    // If the key was already present, no monthKeys change fires the layout effect,
    // so scroll on the next frame directly.
    const raf = requestAnimationFrame(scrollToPending);
    return () => cancelAnimationFrame(raf);
  }, [scrollTarget.nonce, scrollTarget.monthMs, scrollToPending]);

  return (
    <div
      data-testid="calendar-month-grid"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <WeekdayHeader />
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <div ref={topSentinel} style={{ height: 1 }} />
        {monthKeys.map((key) => (
          <MonthBlock
            key={key}
            monthKey={key}
            tasks={tasks}
            cap={MONTH_CAP}
            today={TODAY}
            actions={actions}
            onChipContextMenu={onChipContextMenu}
            onShowMore={onShowMore}
          />
        ))}
        <div ref={bottomSentinel} style={{ height: 1 }} />
      </div>

      {popover && (
        <DayPopover
          dayMs={popover.dayMs}
          chips={popover.chips}
          anchor={popover.anchor}
          onClose={closePopover}
          onChipDragStart={actions.beginDrag}
          onChipDragEnd={actions.endDrag}
          onChipContextMenu={onChipContextMenu}
        />
      )}
    </div>
  );
}
