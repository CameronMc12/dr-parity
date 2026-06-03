'use client';

/**
 * Collapse / expand toggles that sit on each parent's outgoing fan, exactly like
 * real ClickUp. A circular button shows "−" when the subtree is expanded and "+"
 * when it is collapsed. Clicking toggles that node's subtree visibility. Rendered
 * inside the transformed stage so the toggles pan and zoom with the tree.
 */

import { useState } from 'react';
import { TOGGLE_R, type MindToggle } from './layout';

const RING = 'var(--cu-text-secondary, rgb(160,160,160))';
const RING_HOVER = 'var(--cu-text-primary, rgb(225,225,225))';
const FILL = 'var(--cu-bg-app, rgb(20,20,20))';
const GLYPH = 'var(--cu-text-primary, rgb(217,217,217))';

interface Props {
  toggles: MindToggle[];
  onToggle: (nodeId: string) => void;
}

export function MindToggles({ toggles, onToggle }: Props) {
  return (
    <>
      {toggles.map((t) => (
        <ToggleButton key={t.nodeId} toggle={t} onToggle={onToggle} />
      ))}
    </>
  );
}

function ToggleButton({
  toggle,
  onToggle,
}: {
  toggle: MindToggle;
  onToggle: (nodeId: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const size = TOGGLE_R * 2;
  return (
    <button
      type="button"
      data-testid="mindmap-collapse-toggle"
      data-collapsed={toggle.collapsed}
      aria-label={toggle.collapsed ? 'Expand subtree' : 'Collapse subtree'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(toggle.nodeId);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        left: toggle.x - TOGGLE_R,
        top: toggle.y - TOGGLE_R,
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: FILL,
        border: `1.5px solid ${hover ? RING_HOVER : RING}`,
        borderRadius: '50%',
        cursor: 'pointer',
        color: GLYPH,
        padding: 0,
        lineHeight: 1,
        zIndex: 3,
        transition: 'border-color 120ms',
      }}
    >
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12h14" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        {toggle.collapsed && (
          <path d="M12 5v14" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
