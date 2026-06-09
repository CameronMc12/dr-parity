'use client';

import type { ReactNode } from 'react';
import { PrimaryButton } from './controls';
import {
  KebabButton,
  PaneHeader,
  SettingsCard,
  Toolbar,
} from './sections/spaces-primitives';
import {
  BugGlyph,
  CheckCircleGlyph,
  FeatureGlyph,
  MilestoneGlyph,
  TaskTypeIcon,
} from './sections/task-types-primitives';

interface TaskTypeRow {
  id: string;
  name: string;
  description: string;
  usedIn: number;
  glyph: ReactNode;
  color: string;
  isDefault?: boolean;
}

const SEED_TASK_TYPES: TaskTypeRow[] = [
  { id: 'task', name: 'Task', description: 'General work', usedIn: 248, glyph: CheckCircleGlyph, color: '#3e63dd', isDefault: true },
  { id: 'milestone', name: 'Milestone', description: 'Key checkpoint', usedIn: 12, glyph: MilestoneGlyph, color: '#f5a623', isDefault: true },
  { id: 'bug', name: 'Bug', description: 'Defect to fix', usedIn: 37, glyph: BugGlyph, color: '#e5484d' },
  { id: 'feature', name: 'Feature', description: 'New capability', usedIn: 19, glyph: FeatureGlyph, color: '#12A594' },
];

const COL = 'grid grid-cols-[1fr_110px_40px] items-center gap-6 px-6';

export function TaskTypesPane() {
  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <PaneHeader
        title="Task Types"
        description="Use Task Types to manage different kinds of work."
      />

      <Toolbar>
        <div className="ml-auto">
          <PrimaryButton>New Task Type</PrimaryButton>
        </div>
      </Toolbar>

      <SettingsCard>
        <div
          className={`${COL} h-10 border-b border-[#2a2a2a] text-[12px] font-medium uppercase tracking-wide text-[#7b7b7b]`}
        >
          <span>Name</span>
          <span>Used in</span>
          <span />
        </div>

        {SEED_TASK_TYPES.map((type) => (
          <div
            key={type.id}
            className={`${COL} py-3.5 border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#202020] transition-colors`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <TaskTypeIcon glyph={type.glyph} color={type.color} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] text-white truncate">{type.name}</span>
                  {type.isDefault && (
                    <span className="rounded-[4px] text-[11px] font-medium leading-none px-1.5 py-[3px] bg-[#2a2a2a] text-[#b4b4b4]">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-[13px] leading-[18px] text-[#7b7b7b] mt-0.5 truncate">
                  {type.description}
                </p>
              </div>
            </div>
            <span className="text-[13px] text-[#b4b4b4]">{type.usedIn} tasks</span>
            <KebabButton />
          </div>
        ))}
      </SettingsCard>
    </div>
  );
}
