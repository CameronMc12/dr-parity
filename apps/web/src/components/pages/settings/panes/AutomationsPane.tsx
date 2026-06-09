'use client';

import { useState } from 'react';
import { GhostButton, PrimaryButton } from './controls';
import { PaneHeader, Panel, Toggle } from './sections/fields-primitives';

/**
 * Automations — workspace automation inventory. Each row shows the
 * Trigger → Action rule, its location, an on/off toggle, and a run count.
 * Matches ClickUp's Automations settings.
 */

interface Automation {
  id: string;
  trigger: string;
  action: string;
  location: string;
  enabled: boolean;
  runs: number;
}

const SEED_AUTOMATIONS: readonly Automation[] = [
  {
    id: 'a1',
    trigger: 'When status changes to Done',
    action: 'assign to QA',
    location: 'Team Space',
    enabled: true,
    runs: 14,
  },
  {
    id: 'a2',
    trigger: 'When a comment is added',
    action: 'notify the assignee',
    location: 'Product · Roadmap',
    enabled: true,
    runs: 92,
  },
  {
    id: 'a3',
    trigger: 'When due date arrives',
    action: 'move to In Review',
    location: 'Engineering · Sprints',
    enabled: false,
    runs: 0,
  },
];

const COLS = 'grid grid-cols-[1.8fr_1fr_64px_72px] items-center gap-4';

function runsLabel(count: number): string {
  return count === 1 ? '1 run' : `${count} runs`;
}

export function AutomationsPane() {
  const [automations, setAutomations] = useState<Automation[]>([
    ...SEED_AUTOMATIONS,
  ]);

  const toggle = (id: string) =>
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    );

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <PaneHeader
        title="Automations"
        description="Put routine work on autopilot. Each automation runs an action automatically the moment its trigger fires anywhere in the chosen location."
      />

      <div className="mb-5 flex items-center justify-end gap-3">
        <GhostButton>Browse automations</GhostButton>
        <PrimaryButton>Add Automation</PrimaryButton>
      </div>

      <Panel>
        <div
          className={`${COLS} border-b border-[#2a2a2a] px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-[#7b7b7b]`}
        >
          <span>Automation</span>
          <span>Location</span>
          <span>Status</span>
          <span className="text-right">Runs</span>
        </div>

        {automations.map((automation) => (
          <div
            key={automation.id}
            className={`${COLS} border-b border-[#2a2a2a] px-5 py-4 last:border-b-0`}
          >
            <span className="min-w-0 truncate text-[14px] text-white">
              {automation.trigger}{' '}
              <span className="text-[#7b7b7b]">→</span> {automation.action}
            </span>
            <span className="truncate text-[14px] text-[#b4b4b4]">
              {automation.location}
            </span>
            <Toggle
              checked={automation.enabled}
              onChange={() => toggle(automation.id)}
              label={`Toggle ${automation.trigger}`}
            />
            <span className="text-right text-[14px] text-[#b4b4b4]">
              {runsLabel(automation.runs)}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
