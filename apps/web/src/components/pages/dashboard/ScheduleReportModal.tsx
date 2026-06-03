'use client';

/**
 * ScheduleReportModal — the "Schedule report" dialog opened from the dashboard
 * toolbar. ClickUp ships a small scheduling sheet: a frequency selector
 * (Daily / Weekly / Monthly), a day/time control, and a recipients list you can
 * add emails to. Visual + local-state only (no real email send) — recipients
 * and cadence persist in component state for the session.
 *
 * Rendered as a centred fixed overlay (above the view via z-index). Closes on
 * backdrop click and Escape.
 */

import { useEffect, useState } from 'react';
import { DASH } from './tokens';

type Frequency = 'daily' | 'weekly' | 'monthly';

const FREQUENCIES: { value: Frequency; label: string; hint: string }[] = [
  { value: 'daily', label: 'Daily', hint: 'Every morning at 9:00' },
  { value: 'weekly', label: 'Weekly', hint: 'Every Monday at 9:00' },
  { value: 'monthly', label: 'Monthly', hint: 'First of the month' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ScheduleReportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ScheduleReportModal({ open, onClose }: ScheduleReportModalProps) {
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [scheduled, setScheduled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScheduled(false);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const addRecipient = () => {
    const email = draft.trim();
    if (!EMAIL_RE.test(email) || recipients.includes(email)) return;
    setRecipients((r) => [...r, email]);
    setDraft('');
  };

  const removeRecipient = (email: string) =>
    setRecipients((r) => r.filter((x) => x !== email));

  const canSchedule = recipients.length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-label="Schedule report"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          background: DASH.cardBg,
          border: `1px solid ${DASH.border}`,
          borderRadius: DASH.radius,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: `1px solid ${DASH.border}`,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: DASH.textPrimary }}>
            Schedule report
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: 'auto',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: DASH.textMuted,
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Frequency">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FREQUENCIES.map((f) => (
                <FrequencyRow
                  key={f.value}
                  label={f.label}
                  hint={f.hint}
                  selected={frequency === f.value}
                  onSelect={() => setFrequency(f.value)}
                />
              ))}
            </div>
          </Field>

          <Field label={`Recipients${recipients.length ? ` (${recipients.length})` : ''}`}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
                placeholder="name@email.com"
                style={{
                  flex: 1,
                  height: 32,
                  padding: '0 10px',
                  fontSize: 13,
                  color: DASH.textPrimary,
                  background: DASH.bg,
                  border: `1px solid ${DASH.border}`,
                  borderRadius: 6,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={addRecipient}
                disabled={!EMAIL_RE.test(draft.trim())}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: `1px solid ${DASH.border}`,
                  background: 'transparent',
                  color: EMAIL_RE.test(draft.trim()) ? DASH.textPrimary : DASH.textMuted,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: EMAIL_RE.test(draft.trim()) ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                Add
              </button>
            </div>
            {recipients.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {recipients.map((email) => (
                  <span
                    key={email}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 26,
                      padding: '0 6px 0 10px',
                      borderRadius: 13,
                      background: DASH.cardHoverBg,
                      color: DASH.textPrimary,
                      fontSize: 12,
                    }}
                  >
                    {email}
                    <button
                      onClick={() => removeRecipient(email)}
                      aria-label={`Remove ${email}`}
                      style={{
                        width: 16,
                        height: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'transparent',
                        color: DASH.textMuted,
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderTop: `1px solid ${DASH.border}`,
          }}
        >
          {scheduled && (
            <span style={{ fontSize: 12, color: DASH.green }}>
              Report scheduled ({frequency}).
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 6,
                border: `1px solid ${DASH.border}`,
                background: 'transparent',
                color: DASH.textSecondary,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => setScheduled(true)}
              disabled={!canSchedule}
              style={{
                height: 32,
                padding: '0 16px',
                borderRadius: 6,
                border: 'none',
                background: canSchedule ? DASH.accent : DASH.border,
                color: canSchedule ? '#fff' : DASH.textMuted,
                fontSize: 13,
                fontWeight: 600,
                cursor: canSchedule ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: DASH.textSecondary, marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function FrequencyRow({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 6,
        border: `1px solid ${selected ? DASH.accent : DASH.border}`,
        background: selected || hover ? DASH.cardHoverBg : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: `2px solid ${selected ? DASH.accent : DASH.borderStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {selected && (
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: DASH.accent }} />
        )}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13, color: DASH.textPrimary }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, color: DASH.textMuted, marginTop: 1 }}>
          {hint}
        </span>
      </span>
    </button>
  );
}
