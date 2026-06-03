'use client';

/**
 * Automations popover. Two groups — "Browse templates" (canned recipes) and
 * "Your automations" (locally built). A compact builder pairs a When-trigger
 * select with a Then-action select; submitting appends a rendered automation to
 * local state. Trigger/action option sets reference real workspace concepts
 * (statuses, priorities, assignees) without touching the store.
 */

import { useMemo, useRef, useState } from 'react';
import { useMembers } from '@/store/workspace/hooks';
import { useStatusColumns } from '@/lib/view-data';
import {
  GhostButton,
  HeaderIconButton,
  HeaderPopover,
  PanelHeader,
  PrimaryButton,
  SelectField,
  headerTokens,
} from './primitives';
import { BoltIcon, PlusIcon } from './icons';

const { TEXT_MUTED, TEXT_PRIMARY, MENU_BORDER, ACCENT } = headerTokens;

interface Automation {
  id: string;
  when: string;
  then: string;
}

const TEMPLATES: Automation[] = [
  { id: 'tpl-1', when: 'status changes to Complete', then: 'move to Done list' },
  { id: 'tpl-2', when: 'a task is overdue', then: 'post a comment to the assignee' },
  { id: 'tpl-3', when: 'priority is set to Urgent', then: 'notify the watchers' },
];

const THEN_ACTIONS = [
  'assign {member}',
  'set priority to Urgent',
  'post a comment',
  'change status to Complete',
  'add a watcher',
];

function GroupLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        color: TEXT_MUTED,
        padding: '12px 14px 6px',
      }}
    >
      {children}
    </div>
  );
}

function RecipeRow({ when, then }: { when: string; then: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '8px 14px',
        background: hover ? 'var(--cu-bg-hover, #f4f4f4)' : 'transparent',
        cursor: 'default',
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: 'rgba(78,205,196,0.16)',
          color: ACCENT,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <BoltIcon size={14} />
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.35, color: TEXT_PRIMARY }}>
        <span style={{ color: TEXT_MUTED }}>When </span>
        {when}
        <span style={{ color: TEXT_MUTED }}>, then </span>
        {then}
      </span>
    </div>
  );
}

export function AutomationsPanel({ viewId }: { viewId: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [building, setBuilding] = useState(false);
  const [automations, setAutomations] = useState<Automation[]>([]);

  const members = useMembers();
  // Status options come from this project's real status columns.
  const statusCols = useStatusColumns(viewId);

  const triggers = useMemo(() => {
    const statuses = statusCols.map((c) => `status changes to ${c.status}`);
    return statuses.length
      ? statuses
      : ['status changes to In Progress', 'status changes to Complete'];
  }, [statusCols]);

  const thenOptions = useMemo(
    () =>
      THEN_ACTIONS.map((a) =>
        a.includes('{member}')
          ? a.replace('{member}', members[0]?.name ?? 'a teammate')
          : a,
      ),
    [members],
  );

  const [whenSel, setWhenSel] = useState(0);
  const [thenSel, setThenSel] = useState(0);

  const add = () => {
    const when = triggers[whenSel];
    const then = thenOptions[thenSel];
    if (!when || !then) return;
    setAutomations((prev) => [...prev, { id: `auto-${prev.length + 1}-${Date.now()}`, when, then }]);
    setBuilding(false);
    setWhenSel(0);
    setThenSel(0);
  };

  return (
    <>
      <HeaderIconButton
        ref={triggerRef}
        label="Automations"
        active={open}
        onClick={() => setOpen((v) => !v)}
      >
        <BoltIcon />
      </HeaderIconButton>

      <HeaderPopover open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} width={340}>
        <PanelHeader title="Automations" icon={<BoltIcon />} onClose={() => setOpen(false)} />

        <div style={{ padding: '8px 14px 12px' }}>
          {building ? (
            <div
              style={{
                border: `1px solid ${MENU_BORDER}`,
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED }}>WHEN</label>
              <SelectField value={whenSel} onChange={(e) => setWhenSel(Number(e.target.value))}>
                {triggers.map((t, i) => (
                  <option key={t} value={i}>
                    {t}
                  </option>
                ))}
              </SelectField>
              <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED }}>THEN</label>
              <SelectField value={thenSel} onChange={(e) => setThenSel(Number(e.target.value))}>
                {thenOptions.map((t, i) => (
                  <option key={t} value={i}>
                    {t}
                  </option>
                ))}
              </SelectField>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                <GhostButton onClick={() => setBuilding(false)}>Cancel</GhostButton>
                <PrimaryButton onClick={add}>Create</PrimaryButton>
              </div>
            </div>
          ) : (
            <GhostButton onClick={() => setBuilding(true)}>
              <PlusIcon size={14} /> New automation
            </GhostButton>
          )}
        </div>

        <GroupLabel>Browse templates</GroupLabel>
        {TEMPLATES.map((t) => (
          <RecipeRow key={t.id} when={t.when} then={t.then} />
        ))}

        <GroupLabel>Your automations</GroupLabel>
        {automations.length === 0 ? (
          <div style={{ padding: '6px 14px 14px', fontSize: 12.5, color: TEXT_MUTED }}>
            No automations yet. Build one above to get started.
          </div>
        ) : (
          <div style={{ paddingBottom: 8 }}>
            {automations.map((a) => (
              <RecipeRow key={a.id} when={a.when} then={a.then} />
            ))}
          </div>
        )}
      </HeaderPopover>
    </>
  );
}
