'use client';

import {
  forwardRef,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { ViewConfig } from '@/store/workspace/view-config.types';
import { LV } from './tokens';
import { GroupByMenu } from './GroupByMenu';

type ToggleKey =
  | 'showEmptyStatuses'
  | 'wrapText'
  | 'showTaskLocations'
  | 'showSubtaskParentNames'
  | 'showClosed';

const PAGE_TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'showEmptyStatuses', label: 'Show empty statuses' },
  { key: 'wrapText', label: 'Wrap text' },
  { key: 'showTaskLocations', label: 'Show task locations' },
  { key: 'showSubtaskParentNames', label: 'Show subtask parent names' },
  { key: 'showClosed', label: 'Show closed tasks' },
];

const VIEW_TOGGLES = ['Autosave for me', 'Pin view', 'Private view', 'Protect view', 'Set as default view'];
const ACTIONS = ['Copy link to view', 'Favorite', 'Export view', 'Sharing & Permissions'];

const SUBTASKS_LABEL: Record<string, string> = {
  collapsed: 'Collapsed',
  expanded: 'Expanded',
  separate: 'Separate',
};
const GROUP_LABEL: Record<string, string> = {
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  none: 'None',
};

// ── Inline panel building blocks ──────────────────────────────────────────────

function PanelSwitch({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        width: 30,
        height: 17,
        borderRadius: 9999,
        background: checked ? LV.accent : 'var(--cu-border-strong, rgb(70,70,70))',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 140ms ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 15 : 2,
          width: 13,
          height: 13,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 140ms ease',
        }}
      />
    </span>
  );
}

function ToggleRow({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 36,
        padding: '0 16px',
        background: hover ? LV.hover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: LV.textPrimary,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {icon && <span style={{ display: 'flex', color: LV.textMuted, width: 16 }}>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      <PanelSwitch checked={checked} />
    </button>
  );
}

interface NavRowProps {
  label: string;
  value?: string;
  icon?: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

const NavRow = forwardRef<HTMLButtonElement, NavRowProps>(function NavRow(
  { label, value, icon, onClick },
  ref,
) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 36,
        padding: '0 16px',
        background: hover ? LV.hover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: LV.textPrimary,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {icon && <span style={{ display: 'flex', color: LV.textMuted, width: 16 }}>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      {value && <span style={{ fontSize: 12, color: LV.textMuted }}>{value}</span>}
      <span style={{ color: LV.textMuted, fontSize: 13 }}>›</span>
    </button>
  );
});

function PanelDivider() {
  return <div style={{ height: 1, background: LV.border, margin: '6px 0' }} />;
}

// ── Right-side panel ──────────────────────────────────────────────────────────

/**
 * "Customize view" — full right-side panel. Page toggles wire to setViewToggle;
 * the Group row reuses the live GroupByMenu so grouping changes from the panel.
 * View toggles + actions without a backing model are visual no-ops (parity).
 */
export function CustomizeMenu({
  listId,
  config,
  trigger,
}: {
  listId: string;
  config: ViewConfig;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const setViewToggle = useWorkspaceStore((s) => s.setViewToggle);
  const [open, setOpen] = useState(false);
  const [viewFlags, setViewFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  const shownFields = config.visibleColumns.length + 1; // + always-on Name

  return (
    <>
      {trigger({ ref: { current: null }, onClick: () => setOpen((v) => !v), open })}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent' }}
          />
          <aside
            role="dialog"
            aria-label="Customize view"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 320,
              zIndex: 9999,
              background: LV.menuBg,
              borderLeft: `1px solid ${LV.border}`,
              boxShadow: '-8px 0 24px rgba(0,0,0,.3)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'cuPanelIn 140ms ease',
              font: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 48,
                padding: '0 16px',
                borderBottom: `1px solid ${LV.border}`,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: LV.textPrimary, flex: 1 }}>Customize view</span>
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: LV.textMuted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >
                ✕
              </button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 8px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: LV.textSecondary }}>List</span>
              </div>

              {PAGE_TOGGLES.map((t) => (
                <ToggleRow
                  key={t.key}
                  label={t.label}
                  checked={config[t.key]}
                  onChange={(v) => setViewToggle(listId, t.key, v)}
                />
              ))}

              <NavRow label="More options" />
              <PanelDivider />

              <NavRow label="Fields" value={`${shownFields} shown`} />
              <NavRow label="Filter" value="None" />

              <GroupByMenu
                listId={listId}
                groupBy={config.groupBy}
                sortDir={config.sortDir}
                trigger={({ ref, onClick }) => (
                  <NavRow ref={ref} label="Group" value={GROUP_LABEL[config.groupBy]} onClick={onClick} />
                )}
              />

              <NavRow label="Subtasks" value={SUBTASKS_LABEL[config.subtasks]} />
              <NavRow label="Templates" />
              <PanelDivider />

              {VIEW_TOGGLES.map((label) => (
                <ToggleRow
                  key={label}
                  label={label}
                  checked={!!viewFlags[label]}
                  onChange={(v) => setViewFlags((f) => ({ ...f, [label]: v }))}
                />
              ))}
              <PanelDivider />

              {ACTIONS.map((label) => (
                <NavRow key={label} label={label} />
              ))}
            </div>
          </aside>
          <style>{`@keyframes cuPanelIn{from{transform:translateX(16px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
        </>
      )}
    </>
  );
}
