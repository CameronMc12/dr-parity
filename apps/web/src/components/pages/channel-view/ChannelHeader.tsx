'use client';

/**
 * Location header for the list-backed Channel view. Mirrors the real ClickUp
 * channel header: breadcrumb (space avatar / list icon + name + chevron) with a
 * list-settings ellipsis and favorite star, a muted property-picker icon row
 * (description / assignee / priority / dates), and a right action cluster
 * (SyncUp / Agents / Automate / Ask / Share). Buttons are non-crashing (no-op /
 * tooltip). Used only by the Channel view; normal list/space headers are unchanged.
 */

import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { useIsFavorite } from '@/store/workspace/hooks';
import { useScopeCrumbs } from '@/components/views/useViewCrumbs';
import { CaretDown } from '@/components/pages/list-view-icons';
import { StarIcon } from '@/components/shell/header/icons';
import type { ViewScope } from '@/lib/view-scope';
import {
  AiBrandIcon,
  AssigneeIcon,
  AutomateIcon,
  ChevronIcon,
  DatesIcon,
  DescriptionIcon,
  EllipsisIcon,
  PriorityIcon,
  ShareIcon,
  SyncUpIcon,
} from './channel-header-icons';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const TEXT_MUTED = 'var(--cu-text-muted)';
const HOVER_BG = 'var(--cu-bg-hover)';
const STAR_GOLD = 'var(--cu-status-yellow, #f5c344)';

function IconBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 26,
        minWidth: 26,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover || active ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? TEXT_PRIMARY : TEXT_MUTED,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function LabelBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 28,
        padding: '0 9px',
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
      <span style={{ display: 'flex' }}>{label}</span>
    </button>
  );
}

function FavoriteStar({ nodeId }: { nodeId: string }) {
  const favorited = useIsFavorite(nodeId);
  const toggleFavorite = useWorkspaceStore((s) => s.toggleFavorite);
  return (
    <IconBtn
      label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      active={favorited}
      onClick={() => toggleFavorite(nodeId)}
    >
      <span style={{ display: 'flex', color: favorited ? STAR_GOLD : 'inherit' }}>
        <StarIcon filled={favorited} />
      </span>
    </IconBtn>
  );
}

export function ChannelHeader({ scope, listId }: { scope: ViewScope; listId: string }) {
  const crumbs = useScopeCrumbs(scope, 'Channel');

  return (
    <div
      data-testid="channel-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 44,
        paddingLeft: 20,
        paddingRight: 16,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Breadcrumb */}
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={crumb.label + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 16,
                height: 16,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: crumb.color,
                flexShrink: 0,
              }}
            >
              {crumb.glyph}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: last ? 600 : 500,
                color: last ? TEXT_PRIMARY : TEXT_SECONDARY,
                whiteSpace: 'nowrap',
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {crumb.label}
            </span>
            {last && <CaretDown size={12} />}
            {!last && <span style={{ color: TEXT_MUTED, fontSize: 13, margin: '0 2px' }}>/</span>}
          </span>
        );
      })}

      <IconBtn label="List settings">
        <EllipsisIcon />
      </IconBtn>
      <FavoriteStar nodeId={listId} />

      {/* Property-picker icon row */}
      <span style={{ width: 1, height: 18, background: 'var(--cu-border-divider)', margin: '0 6px' }} />
      <IconBtn label="Description">
        <DescriptionIcon />
      </IconBtn>
      <IconBtn label="Assignee">
        <AssigneeIcon />
      </IconBtn>
      <IconBtn label="Priority">
        <PriorityIcon />
      </IconBtn>
      <IconBtn label="Dates">
        <DatesIcon />
      </IconBtn>

      <span style={{ flex: 1 }} />

      {/* Right action cluster */}
      <button
        type="button"
        aria-label="SyncUp"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 28,
          padding: '0 8px',
          background: 'transparent',
          border: '1px solid var(--cu-border-divider)',
          borderRadius: 6,
          cursor: 'pointer',
          color: TEXT_SECONDARY,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <SyncUpIcon />
        <ChevronIcon />
      </button>
      <IconBtn label="Agents">
        <AiBrandIcon />
      </IconBtn>
      <LabelBtn label="Automate">
        <AutomateIcon size={15} />
      </LabelBtn>
      <LabelBtn label="Ask">
        <AiBrandIcon size={15} />
      </LabelBtn>
      <LabelBtn label="Share">
        <ShareIcon size={15} />
      </LabelBtn>
    </div>
  );
}
