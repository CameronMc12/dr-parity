'use client';

/**
 * Gantt-specific toolbar chrome split into two clusters that bracket the shared
 * `<ViewToolbar>`:
 *
 *   LEFT  — left-pane collapse toggle | Today | zoom dropdown (Day/Week/Month) |
 *           Auto fit | Export (download → PDF/PNG/CSV menu).
 *   RIGHT — two dependency-mode toggle icons (waiting-on / linked).
 *
 * Breadcrumb + view-tab strip come from the shared `<ViewShell>`; this file owns
 * only the Gantt control row pieces.
 */

import { useEffect, useRef, useState } from 'react';
import {
  GANTT,
  ZOOM_LABEL,
  ZOOM_OPTIONS,
  type GanttZoom,
} from './tokens';
import { GanttExportModal } from './GanttExportModal';

// ── icons ─────────────────────────────────────────────────────────────────────

function PanelCollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth={1.6} />
      <line x1="9" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth={1.6} />
      <path
        d={collapsed ? 'M13 9l3 3-3 3' : 'M6 9l-3 3 3 3'}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={collapsed ? 'translate(-2 0)' : 'translate(2 0)'}
      />
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

function AutoFitIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 18h14"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CaretIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DependenciesIcon() {
  // ClickUp's `dependencies` icon: two linked chain rings.
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 14.5l5-5M8 12.5l-1.8 1.8a2.8 2.8 0 104 4l1.8-1.8M16 11.5l1.8-1.8a2.8 2.8 0 10-4-4L12 7.7"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CriticalPathIcon() {
  // A zig-zag "longest path" glyph for the critical-path toggle.
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 18l5-7 4 3 7-9"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── reusable buttons ──────────────────────────────────────────────────────────

function IconButton({
  children,
  label,
  testid,
  active,
  bordered,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  testid: string;
  active?: boolean;
  /** Render ClickUp's resting 1px pill outline (left-cluster controls). */
  bordered?: boolean;
  onClick: () => void;
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
        background: active ? GANTT.activeTint : hover ? GANTT.hover : 'transparent',
        border: bordered ? `1px solid ${GANTT.gridBorder}` : 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? GANTT.activeText : GANTT.textSecondary,
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}

function TextButton({
  icon,
  label,
  testid,
  active,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  testid: string;
  active?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      data-testid={testid}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 10px',
        background: hover || active ? GANTT.hover : 'transparent',
        border: `1px solid ${GANTT.gridBorder}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? GANTT.textPrimary : GANTT.textSecondary,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── zoom dropdown (Day / Week / Month) ────────────────────────────────────────

function ZoomDropdown({ zoom, onZoom }: { zoom: GanttZoom; onZoom: (z: GanttZoom) => void }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        data-testid="gantt-view-controls__time-period-dropdown"
        aria-haspopup="menu"
        aria-label="Time period"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 10px',
          background: hover || open ? GANTT.hover : 'transparent',
          border: `1px solid ${GANTT.gridBorder}`,
          borderRadius: 6,
          cursor: 'pointer',
          color: open ? GANTT.textPrimary : GANTT.textSecondary,
          fontSize: 13,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
        }}
      >
        {ZOOM_LABEL[zoom]}
        <CaretIcon />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Time period"
          style={{
            position: 'absolute',
            top: 34,
            left: 0,
            minWidth: 168,
            padding: 4,
            background: 'var(--cu-bg-menu)',
            border: `1px solid ${GANTT.gridBorder}`,
            borderRadius: 8,
            boxShadow: 'var(--cu-shadow-lg)',
            zIndex: 50,
          }}
        >
          <div
            role="presentation"
            style={{
              padding: '6px 10px 4px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: GANTT.textMuted,
            }}
          >
            Time period
          </div>
          {ZOOM_OPTIONS.map((z) => {
            const active = z === zoom;
            return (
              <button
                key={z}
                role="menuitemradio"
                aria-checked={active}
                data-testid={`gantt-zoom-${z}`}
                onClick={() => {
                  onZoom(z);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  height: 30,
                  padding: '0 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: active ? GANTT.textPrimary : GANTT.textSecondary,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = GANTT.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{ZOOM_LABEL[z]}</span>
                {active && (
                  <span style={{ color: GANTT.textPrimary, display: 'inline-flex' }}>
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── export button (opens the "Export Gantt" modal) ────────────────────────────

function ExportButton({ spanStart, spanEnd }: { spanStart: number; spanEnd: number }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  return (
    <>
      <button
        data-testid="gantt-view-controls__export-button"
        aria-haspopup="dialog"
        aria-label="Export"
        aria-expanded={open}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 10px',
          background: hover || open ? GANTT.hover : 'transparent',
          border: `1px solid ${GANTT.gridBorder}`,
          borderRadius: 6,
          cursor: 'pointer',
          color: open ? GANTT.textPrimary : GANTT.textSecondary,
          fontSize: 13,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
        }}
      >
        <DownloadIcon />
        Export
      </button>
      {open && (
        <GanttExportModal
          spanStart={spanStart}
          spanEnd={spanEnd}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ── left cluster (rendered before the shared ViewToolbar) ─────────────────────

export function GanttToolbarLeft({
  zoom,
  onZoom,
  onToday,
  onAutoFit,
  paneCollapsed,
  onTogglePane,
  spanStart,
  spanEnd,
}: {
  zoom: GanttZoom;
  onZoom: (z: GanttZoom) => void;
  onToday: () => void;
  onAutoFit: () => void;
  paneCollapsed: boolean;
  onTogglePane: () => void;
  /** Earliest task-span start (ms) — seeds the export modal's Start Date. */
  spanStart: number;
  /** Latest task-span end (ms) — seeds the export modal's End Date. */
  spanEnd: number;
}) {
  return (
    <div
      data-testid="gantt-toolbar-left"
      style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40, paddingLeft: 12, flexShrink: 0 }}
    >
      <IconButton
        label={paneCollapsed ? 'Show task list' : 'Hide task list'}
        testid="gantt-view-controls__sidebar-toggle-button"
        active={paneCollapsed}
        bordered
        onClick={onTogglePane}
      >
        <PanelCollapseIcon collapsed={paneCollapsed} />
      </IconButton>
      <TextButton icon={<TodayIcon />} label="Today" testid="gantt-view-controls__today-button" onClick={onToday} />
      <ZoomDropdown zoom={zoom} onZoom={onZoom} />
      <TextButton icon={<AutoFitIcon />} label="Auto fit" testid="gantt-view-controls__auto-fit-button" onClick={onAutoFit} />
      <ExportButton spanStart={spanStart} spanEnd={spanEnd} />
    </div>
  );
}

// ── right cluster (reschedule deps + critical path) ───────────────────────────

export interface GanttDependencyState {
  rescheduleDependencies: boolean;
  criticalPath: boolean;
}

export function GanttDependencyToggles({
  state,
  onToggleReschedule,
  onToggleCriticalPath,
}: {
  state: GanttDependencyState;
  onToggleReschedule: () => void;
  onToggleCriticalPath: () => void;
}) {
  // ClickUp's captured Gantt sub-toolbar shows only the two dependency icon
  // toggles (reschedule + critical path) between Export and the shared Sort
  // control. The Baselines pill is not present in this workspace's capture.
  return (
    <div
      data-testid="gantt-view-controls__toggle-icons"
      role="group"
      aria-label="Dependency controls"
      style={{ display: 'flex', alignItems: 'center', gap: 2, paddingLeft: 6, paddingRight: 2 }}
    >
      <IconButton
        label="Reschedule dependencies"
        testid="gantt-view-controls__reschedule-dependencies-toggle"
        active={state.rescheduleDependencies}
        onClick={onToggleReschedule}
      >
        <DependenciesIcon />
      </IconButton>
      <IconButton
        label="Highlight critical path"
        testid="gantt-view-controls__critical-path-toggle"
        active={state.criticalPath}
        onClick={onToggleCriticalPath}
      >
        <CriticalPathIcon />
      </IconButton>
    </div>
  );
}
