'use client';

/**
 * A single Freeform node: a rounded card with editable text, a right-edge
 * connection handle, and drag-to-move. Double-click (or Enter) edits the label;
 * blur / Enter commits. Dragging the body moves the node; dragging the round
 * handle starts an edge. Right-click bubbles a custom event for the canvas menu.
 * All pointer coordinates are converted from screen to canvas space by callers.
 */

import { useEffect, useRef, useState } from 'react';
import { FREE_NODE_H, FREE_NODE_W, type FreeNode } from './freeform-model';

const CARD_BG = 'var(--cu-bg-menu, rgb(34,34,34))';
const CARD_BORDER = 'var(--cu-border-divider, rgba(255,255,255,0.10))';
const CARD_BORDER_HOVER = 'var(--cu-border-strong, rgba(255,255,255,0.24))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(217,217,217))';
const ACCENT = 'var(--cu-accent, #4ecdc4)';
const TASK_ACCENT = 'var(--cu-status-green, rgb(99,200,114))';
const SHADOW = '0 1px 3px rgba(0,0,0,0.35)';
const SHADOW_HOVER = '0 6px 18px rgba(0,0,0,0.45)';

interface Props {
  node: FreeNode;
  editing: boolean;
  /** True while an edge is being dragged from another node toward this one. */
  linkTarget: boolean;
  onBodyPointerDown: (e: React.PointerEvent, node: FreeNode) => void;
  onHandlePointerDown: (e: React.PointerEvent, node: FreeNode) => void;
  onStartEdit: (id: string) => void;
  onCommitEdit: (id: string, text: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FreeNode) => void;
}

export function FreeNodeCard({
  node,
  editing,
  linkTarget,
  onBodyPointerDown,
  onHandlePointerDown,
  onStartEdit,
  onCommitEdit,
  onContextMenu,
}: Props) {
  const [hover, setHover] = useState(false);
  const isTask = Boolean(node.taskId);
  const accent = isTask ? TASK_ACCENT : ACCENT;
  const showHandle = hover || editing;

  return (
    <div
      data-testid="freeform-node"
      data-node-id={node.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: FREE_NODE_W,
        minHeight: FREE_NODE_H,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onPointerDown={(e) => {
          if (editing) return;
          onBodyPointerDown(e, node);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartEdit(node.id);
        }}
        onContextMenu={(e) => onContextMenu(e, node)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !editing) {
            e.preventDefault();
            onStartEdit(node.id);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: FREE_NODE_H,
          padding: '8px 12px',
          background: CARD_BG,
          border: `1px solid ${linkTarget ? accent : hover ? CARD_BORDER_HOVER : CARD_BORDER}`,
          borderLeft: `3px solid ${accent}`,
          borderRadius: 10,
          boxShadow: linkTarget ? `0 0 0 2px ${accent}, ${SHADOW}` : hover ? SHADOW_HOVER : SHADOW,
          cursor: editing ? 'text' : 'grab',
          transition: 'box-shadow 120ms, border-color 120ms',
          userSelect: 'none',
        }}
      >
        {editing ? (
          <NodeEditor
            initial={node.text}
            onCommit={(text) => onCommitEdit(node.id, text)}
          />
        ) : (
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: TEXT_PRIMARY,
              lineHeight: 1.35,
              wordBreak: 'break-word',
              width: '100%',
            }}
          >
            {node.text || 'Untitled'}
          </span>
        )}
      </div>

      {showHandle && (
        <span
          data-testid="freeform-handle"
          title="Drag to connect"
          onPointerDown={(e) => onHandlePointerDown(e, node)}
          style={{
            position: 'absolute',
            right: -7,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: accent,
            border: '2px solid var(--cu-bg-app, rgb(20,20,20))',
            cursor: 'crosshair',
            boxShadow: SHADOW,
          }}
        />
      )}
    </div>
  );
}

function NodeEditor({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (text: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  return (
    <textarea
      ref={ref}
      defaultValue={initial}
      rows={1}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onCommit(e.currentTarget.value.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onCommit(e.currentTarget.value.trim());
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCommit(initial);
        }
        e.stopPropagation();
      }}
      style={{
        width: '100%',
        resize: 'none',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: TEXT_PRIMARY,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        lineHeight: 1.35,
      }}
    />
  );
}
