'use client';

import { useState } from 'react';
import { SectionLabel, Card, CardRow } from './general-primitives';
import { WorkspaceToggle } from './general-controls';

export function PersonalLayoutSection() {
  const [sidebar, setSidebar] = useState(true);
  const [comments, setComments] = useState(true);

  return (
    <section>
      <SectionLabel>Personal Layout</SectionLabel>
      <Card>
        <CardRow
          label="Sidebar"
          description="Show the navigation sidebar by default when you open this Workspace."
        >
          <WorkspaceToggle checked={sidebar} onCheckedChange={setSidebar} />
        </CardRow>
        <CardRow
          label="Comments"
          description="Show the comments panel alongside tasks and Docs you open."
        >
          <WorkspaceToggle checked={comments} onCheckedChange={setComments} />
        </CardRow>
      </Card>
    </section>
  );
}
