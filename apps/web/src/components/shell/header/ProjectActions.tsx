'use client';

/**
 * Project-header action cluster (right side of the breadcrumb row). Order
 * mirrors ClickUp: favorite star · Call (caret) · Automations · Ask · Share ·
 * presence stack. The star toggles the workspace favorite for this list; every
 * other control opens its own interactive popover/panel.
 */

import { useWorkspaceStore } from '@/store/workspace';
import { useIsFavorite } from '@/store/workspace/hooks';
import { HeaderIconButton } from './primitives';
import { StarIcon } from './icons';
import { CallPopover } from './CallPopover';
import { AutomationsPanel } from './AutomationsPanel';
import { AskPanel } from './AskPanel';
import { SharePanel } from './SharePanel';
import { PresencePopover } from './PresencePopover';

const STAR_GOLD = 'var(--cu-status-yellow, #f5c344)';

function FavoriteStar({ nodeId }: { nodeId: string }) {
  const favorited = useIsFavorite(nodeId);
  const toggleFavorite = useWorkspaceStore((s) => s.toggleFavorite);
  return (
    <HeaderIconButton
      label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      active={favorited}
      onClick={() => toggleFavorite(nodeId)}
    >
      <span style={{ display: 'flex', color: favorited ? STAR_GOLD : 'inherit' }}>
        <StarIcon filled={favorited} />
      </span>
    </HeaderIconButton>
  );
}

export function ProjectActions({
  listId,
  viewId,
  projectName,
}: {
  listId: string;
  viewId: string;
  projectName: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
      }}
    >
      <FavoriteStar nodeId={listId} />
      <span style={{ width: 1, height: 18, background: 'var(--cu-border-divider, #e8e8e8)', margin: '0 4px' }} />
      <CallPopover />
      <AutomationsPanel viewId={viewId} />
      <AskPanel projectName={projectName} />
      <SharePanel projectName={projectName} />
      <span style={{ width: 1, height: 18, background: 'var(--cu-border-divider, #e8e8e8)', margin: '0 2px 0 4px' }} />
      <PresencePopover />
    </div>
  );
}
