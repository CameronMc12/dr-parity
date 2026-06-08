'use client';

/**
 * Ask AI header trigger. Sits in the project-header action cluster next to
 * Share. Clicking it opens the shared right-docked Brain / Max panel scoped to
 * the current space/project (via the ui-store), rather than toggling its own
 * local popover. The panel itself lives in components/ai-panel.
 */

import { useUiStore } from '@/store/ui-store';
import { HeaderIconButton } from './primitives';
import { AiBrandIcon } from './icons';

export function AskPanel({ projectName }: { projectName: string }) {
  const open = useUiStore((s) => s.aiPanelOpen);
  const scope = useUiStore((s) => s.aiPanelScope);
  const openAiPanel = useUiStore((s) => s.openAiPanel);
  const active = open && scope === projectName;

  return (
    <HeaderIconButton
      label="Ask AI"
      active={active}
      width={66}
      onClick={() => openAiPanel(projectName)}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '0 6px',
          fontSize: 12.5,
          fontWeight: 500,
          color: 'inherit',
        }}
      >
        <span style={{ display: 'flex' }}>
          <AiBrandIcon size={15} />
        </span>
        Ask AI
      </span>
    </HeaderIconButton>
  );
}
