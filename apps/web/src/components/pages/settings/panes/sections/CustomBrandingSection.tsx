'use client';

import { useState } from 'react';
import { SectionLabel, EnterpriseBadge, Card, CardRow } from './general-primitives';
import {
  WorkspaceToggle,
  AddLogoButton,
  ColorSchemeRow,
  CustomUrlField,
} from './general-controls';

const SCHEME_COLORS = [
  '#7b7b7b',
  '#8b5cf6',
  '#3e63dd',
  '#ec4899',
  '#d946ef',
  '#6366f1',
  '#f76808',
  '#12a594',
  '#d6b89a',
  '#30a46c',
] as const;

export function CustomBrandingSection() {
  const [enabled, setEnabled] = useState(false);
  const [scheme, setScheme] = useState<string>(SCHEME_COLORS[0]);
  const [customUrl, setCustomUrl] = useState('');

  return (
    <section>
      <SectionLabel badge={<EnterpriseBadge />}>Custom branding</SectionLabel>
      <Card>
        <CardRow label="Enable custom branding">
          <WorkspaceToggle checked={enabled} onCheckedChange={setEnabled} />
        </CardRow>

        <CardRow
          label="Round logo"
          description="We recommend a 72 x 72 px PNG file. This logo is used in-app as your Workspace avatar."
        >
          <AddLogoButton />
        </CardRow>

        <CardRow
          label="Rectangle logo"
          description="We recommend a 232 x 48 px PNG file. This logo appears on emails, your login screen, and public links to items like Forms, Docs, Dashboards, and tasks."
        >
          <AddLogoButton />
        </CardRow>

        <CardRow
          label="Social media graphic"
          description="We recommend a 500 x 260 px PNG file. This graphic serves as the preview image when ClickUp links are shared."
        >
          <AddLogoButton />
        </CardRow>

        <CardRow label="Color scheme">
          <ColorSchemeRow
            colors={SCHEME_COLORS}
            selected={scheme}
            onSelect={setScheme}
          />
        </CardRow>

        <CardRow label="Custom URL">
          <CustomUrlField value={customUrl} onChange={setCustomUrl} />
        </CardRow>
      </Card>
    </section>
  );
}
