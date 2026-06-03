'use client';

/**
 * "Export Gantt" modal — a 1:1 dark-theme rebuild of ClickUp's Gantt export
 * dialog (docs/research/clickup-parity/interactions/gantt/export.png).
 *
 * Structure mirrors the capture top-to-bottom:
 *   - title "Export Gantt" + close (X)
 *   - a chart-preview thumbnail
 *   - a PDF / PNG segmented toggle
 *   - Start Date / End Date pickers, each with a "Change start and due dates"
 *     sub-label, seeded from the visible task span
 *   - Header / Footer text inputs
 *   - Cancel / Export footer buttons
 *
 * The actual file-render is a visual no-op (PDF/PNG generation has no backing
 * model offline); selecting a format + dates + caption and pressing Export
 * closes the dialog. Every field is wired to local state so the form is live.
 */

import { useState } from 'react';
import { startOfDay } from '@/lib/view-data';
import { GANTT } from './tokens';

type ExportFormat = 'PDF' | 'PNG';

/** ms → "YYYY-MM-DD" for a native date input value. */
function toInputDate(ms: number): string {
  const d = new Date(startOfDay(ms));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function CloseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth={1.6} />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth={1.6} />
      <line x1="8" y1="2.5" x2="8" y2="6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <line x1="16" y1="2.5" x2="16" y2="6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

/** A miniature Gantt drawing used as the dialog's preview thumbnail. */
function PreviewThumb() {
  const bars = [
    { top: 14, left: 18, width: 64, fill: 'rgba(255,255,255,0.34)' },
    { top: 30, left: 40, width: 88, fill: 'rgba(255,255,255,0.28)' },
    { top: 46, left: 70, width: 56, fill: 'rgba(255,255,255,0.22)' },
    { top: 62, left: 96, width: 72, fill: 'rgba(255,255,255,0.18)' },
  ];
  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        height: 132,
        borderRadius: 8,
        background: 'var(--cu-bg-input)',
        border: `1px solid ${GANTT.gridBorder}`,
        overflow: 'hidden',
      }}
    >
      {[28, 56, 84, 112, 140, 168, 196].map((x) => (
        <div
          key={x}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: x,
            width: 1,
            background: 'rgba(255,255,255,0.06)',
          }}
        />
      ))}
      {bars.map((b) => (
        <div
          key={b.top}
          style={{
            position: 'absolute',
            top: b.top,
            left: b.left,
            width: b.width,
            height: 8,
            borderRadius: 4,
            background: b.fill,
          }}
        />
      ))}
    </div>
  );
}

function FormatToggle({
  value,
  onChange,
}: {
  value: ExportFormat;
  onChange: (f: ExportFormat) => void;
}) {
  const formats: ExportFormat[] = ['PDF', 'PNG'];
  return (
    <div
      role="tablist"
      aria-label="Export format"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 4,
        padding: 4,
        background: 'var(--cu-bg-input)',
        borderRadius: 8,
        border: `1px solid ${GANTT.gridBorder}`,
      }}
    >
      {formats.map((f) => {
        const active = f === value;
        return (
          <button
            key={f}
            role="tab"
            aria-selected={active}
            data-testid={`gantt-export-format-${f.toLowerCase()}`}
            onClick={() => onChange(f)}
            style={{
              height: 30,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              background: active ? GANTT.activeTint : 'transparent',
              color: active ? GANTT.activeText : GANTT.textSecondary,
              transition: 'background 120ms',
            }}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testid: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: GANTT.textSecondary }}>{label}</span>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 34,
          padding: '0 10px',
          borderRadius: 8,
          background: 'var(--cu-bg-input)',
          border: `1px solid ${GANTT.gridBorder}`,
          color: GANTT.textMuted,
          cursor: 'pointer',
        }}
      >
        <CalendarIcon />
        <input
          type="date"
          value={value}
          data-testid={testid}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: GANTT.textPrimary,
            fontSize: 13,
            fontFamily: 'inherit',
            colorScheme: 'dark',
          }}
        />
      </label>
      <span style={{ fontSize: 11, color: GANTT.textMuted }}>Change start and due dates</span>
    </div>
  );
}

function CaptionInput({
  label,
  value,
  placeholder,
  onChange,
  testid,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  testid: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: GANTT.textSecondary }}>{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        data-testid={testid}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 34,
          padding: '0 10px',
          borderRadius: 8,
          background: 'var(--cu-bg-input)',
          border: `1px solid ${GANTT.gridBorder}`,
          color: GANTT.textPrimary,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </div>
  );
}

export function GanttExportModal({
  spanStart,
  spanEnd,
  onClose,
}: {
  spanStart: number;
  spanEnd: number;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>('PDF');
  const [start, setStart] = useState(() => toInputDate(spanStart));
  const [end, setEnd] = useState(() => toInputDate(spanEnd));
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');

  return (
    <div
      role="presentation"
      data-testid="gantt-export-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export Gantt"
        data-testid="gantt-export-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: 'var(--cu-bg-menu)',
          borderRadius: 12,
          border: `1px solid ${GANTT.gridBorder}`,
          boxShadow: 'var(--cu-shadow-lg)',
          color: GANTT.textPrimary,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px 12px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Export Gantt</h2>
          <button
            aria-label="Close"
            data-testid="gantt-export-modal__close"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              color: GANTT.textSecondary,
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = GANTT.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 18px 4px' }}>
          <PreviewThumb />
          <FormatToggle value={format} onChange={setFormat} />

          <div style={{ display: 'flex', gap: 12 }}>
            <DateField
              label="Start Date"
              value={start}
              onChange={setStart}
              testid="gantt-export-start-date"
            />
            <DateField
              label="End Date"
              value={end}
              onChange={setEnd}
              testid="gantt-export-end-date"
            />
          </div>

          <CaptionInput
            label="Header"
            value={header}
            placeholder="e.g. Gantt name"
            onChange={setHeader}
            testid="gantt-export-header"
          />
          <CaptionInput
            label="Footer"
            value={footer}
            placeholder="e.g. Gantt name"
            onChange={setFooter}
            testid="gantt-export-footer"
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '16px 18px 18px',
          }}
        >
          <button
            data-testid="gantt-export-cancel"
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 18px',
              border: `1px solid ${GANTT.gridBorder}`,
              borderRadius: 8,
              background: 'transparent',
              color: GANTT.textPrimary,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = GANTT.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Cancel
          </button>
          <button
            data-testid="gantt-export-confirm"
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 22px',
              border: 'none',
              borderRadius: 8,
              background: 'var(--cu-accent)',
              color: '#0b1f1d',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
