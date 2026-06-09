'use client';

import { useState } from 'react';
import { Card, SectionLabel } from './sections/general-primitives';
import { PrimaryButton } from './controls';
import { PaneShell, Avatar, KebabButton, EmptyRow } from './sections/people-shared';

interface TeamRow {
  id: string;
  name: string;
  memberCount: number;
}

const SEED_TEAMS: TeamRow[] = [{ id: 't1', name: 'Engineering', memberCount: 1 }];

export function TeamsPane() {
  const [teams] = useState<TeamRow[]>(SEED_TEAMS);

  return (
    <PaneShell title="Teams">
      <div className="flex items-start gap-4 mb-5">
        <div className="min-w-0 flex-1">
          <SectionLabel>Teams</SectionLabel>
          <p className="text-[13px] leading-[18px] text-[#7b7b7b] max-w-[440px]">
            Teams are groups of members you can @mention and assign work to.
          </p>
        </div>
        <div className="shrink-0">
          <PrimaryButton>Create Team</PrimaryButton>
        </div>
      </div>

      <Card>
        {teams.length === 0 ? (
          <EmptyRow>You haven&apos;t created any Teams yet</EmptyRow>
        ) : (
          teams.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 px-6 py-4 border-b border-[#2a2a2a] last:border-b-0"
            >
              <Avatar name={t.name} shape="square" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-white leading-tight truncate">{t.name}</p>
                <p className="text-[13px] text-[#7b7b7b]">
                  {t.memberCount} member{t.memberCount === 1 ? '' : 's'}
                </p>
              </div>
              <KebabButton />
            </div>
          ))
        )}
      </Card>
    </PaneShell>
  );
}
