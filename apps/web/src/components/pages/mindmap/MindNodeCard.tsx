'use client';

/**
 * A single Mind Map node, matching real ClickUp's node anatomy.
 *
 * - Pill-shaped card (large radius), solid surface, NO left status border.
 * - Root ("Project 1") shows a list glyph + bold name, no status chip / menu.
 * - Task / subtask nodes show a small square status chip (status colour), the
 *   name, and a trailing diagonal "open" arrow that opens the task modal.
 * - Single-click opens the task; double-click also opens (parity with ClickUp).
 * - Right-click opens the shared task context menu.
 * - Hovering reveals a "+" affordance on the right edge that adds a child.
 *
 * Rendered in our dark tokens; geometry/structure mirror the capture.
 */

import { useState } from 'react';
import type { MindNode } from './layout';
import { NODE_H, NODE_W } from './layout';

const CARD_BG = 'var(--cu-bg-menu, rgb(34,34,34))';
const CARD_BORDER = 'var(--cu-border-divider, rgba(255,255,255,0.10))';
const CARD_BORDER_HOVER = 'var(--cu-border-strong, rgba(255,255,255,0.22))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(217,217,217))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(140,140,140))';
const ROOT_GLYPH = 'var(--cu-text-secondary, rgb(160,160,160))';
const SHADOW = '0 1px 3px rgba(0,0,0,0.35)';
const SHADOW_HOVER = '0 4px 14px rgba(0,0,0,0.45)';
const ADD_BG = 'var(--cu-bg-app, rgb(20,20,20))';
const DEFAULT_STATUS = 'var(--cu-text-muted, rgb(140,140,140))';

interface Props {
  node: MindNode;
  onOpen: (node: MindNode) => void;
  onAddChild: (node: MindNode) => void;
  onContextMenu: (e: React.MouseEvent, node: MindNode) => void;
}

export function MindNodeCard({ node, onOpen, onAddChild, onContextMenu }: Props) {
  const [hover, setHover] = useState(false);
  const isRoot = node.kind === 'root';
  const statusColor = node.statusColor || DEFAULT_STATUS;

  return (
    <div
      data-testid="mindmap-node"
      data-node-kind={node.kind}
      style={{ position: 'absolute', left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        role={isRoot ? undefined : 'button'}
        tabIndex={isRoot ? undefined : 0}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={isRoot ? undefined : () => onOpen(node)}
        onDoubleClick={isRoot ? undefined : () => onOpen(node)}
        onKeyDown={
          isRoot
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(node);
                }
              }
        }
        onContextMenu={isRoot ? undefined : (e) => onContextMenu(e, node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: '100%',
          padding: '0 12px',
          background: CARD_BG,
          border: `1px solid ${hover ? CARD_BORDER_HOVER : CARD_BORDER}`,
          borderRadius: 12,
          cursor: isRoot ? 'default' : 'pointer',
          boxShadow: hover ? SHADOW_HOVER : SHADOW,
          transform: hover ? 'translateY(-1px)' : 'none',
          transition: 'box-shadow 120ms, border-color 120ms, transform 120ms',
          userSelect: 'none',
        }}
      >
        {isRoot ? (
          <ListGlyph />
        ) : (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 11,
              height: 11,
              borderRadius: 2,
              background: statusColor,
            }}
          />
        )}

        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: isRoot ? 600 : 500,
            color: TEXT_PRIMARY,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {node.label}
        </span>

        {!isRoot && (
          <OpenArrow
            visible={hover}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(node);
            }}
          />
        )}
      </div>

      {hover && (
        <button
          type="button"
          aria-label="Add child task"
          data-testid="mindmap-add-child"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(node);
          }}
          style={{
            position: 'absolute',
            right: -14,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `1px solid ${CARD_BORDER_HOVER}`,
            background: ADD_BG,
            color: TEXT_PRIMARY,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 15,
            lineHeight: 1,
            boxShadow: SHADOW,
            zIndex: 2,
          }}
        >
          +
        </button>
      )}
    </div>
  );
}

/** ClickUp's "open task" trailing affordance: a diagonal expand arrow. */
function OpenArrow({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label="Open task"
      data-testid="mindmap-open-task"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 18,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: TEXT_MUTED,
        opacity: visible ? 1 : 0.55,
        transition: 'opacity 120ms',
      }}
    >
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M14 5h5v5M19 5l-7 7M10 19H5v-5M5 19l7-7"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function ListGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, color: ROOT_GLYPH }}
    >
      <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx={4} cy={6} r={1.4} fill="currentColor" />
      <circle cx={4} cy={12} r={1.4} fill="currentColor" />
      <circle cx={4} cy={18} r={1.4} fill="currentColor" />
    </svg>
  );
}
