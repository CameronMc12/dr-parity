'use client';

import { useState } from 'react';
import { SectionLabel, Card, CardRow } from './general-primitives';
import { WorkspaceAvatar } from './general-controls';

export function GeneralSection() {
  const [name, setName] = useState("Cameron Mc's Workspace");

  return (
    <section>
      <SectionLabel>General</SectionLabel>
      <Card>
        <CardRow label="Avatar">
          <WorkspaceAvatar />
        </CardRow>
        <CardRow label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="
              w-[220px] h-9 px-3 rounded-[6px] text-sm text-white
              bg-[#2a2a2a] border border-[#2a2a2a]
              placeholder:text-[#7b7b7b] focus:outline-none focus:border-[#3e63dd]
              transition-colors
            "
          />
        </CardRow>
      </Card>
    </section>
  );
}
