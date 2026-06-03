'use client';

/**
 * Bottom-center floating tool palette for the whiteboard, matching ClickUp's
 * real tldraw-backed toolbar anatomy: a Select/Hand pair, a wide "Task" pill,
 * Draw, Shapes (flyout: rectangle / ellipse / triangle / diamond), Arrow, Sticky
 * Note, Text, Frame, Image, Connector, an AI-tools icon button, then a divided
 * Undo/Redo group on the right. Each tool shows its single-letter keyboard hint
 * above the glyph, exactly like the captured ClickUp toolbar.
 *
 * Rendered in our dark tokens: the active tool uses a subtle light fill (not a
 * solid brand colour). Every button is real — selecting a tool changes the
 * canvas mode, the Shape flyout picks the concrete variant, Undo/Redo drive the
 * whiteboard history. Zoom + presence live in sibling components.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ShapeVariant, ToolId } from './types';
import { isShapeVariant } from './types';

// ClickUp's dark Whiteboard toolbar: an elevated dark floating pill with
// light/muted glyphs and a few rich-coloured icon tiles (yellow sticky, etc.).
// All surfaces use our dark --cu-* tokens so the toolbar matches the app shell.
const PILL_BG = 'var(--cu-bg-menu, #222222)';
const BORDER = 'var(--cu-border-divider, #363636)';
const ICON = 'var(--cu-text-secondary, #aaaaaa)';
const ICON_MUTED = 'var(--cu-text-muted, #7b7b7b)';
const ACTIVE_BG = 'var(--cu-accent-subtle, rgba(78,205,196,0.20))';
const ACTIVE_FG = 'var(--cu-accent, #4ecdc4)';
const HOVER_BG = 'var(--cu-bg-hover, rgba(255,255,255,0.08))';
const DIVIDER = 'var(--cu-border-divider, #363636)';

// Rich icon-tile colours (match the real toolbar's coloured glyphs). These stay
// fixed across themes — they are the tool's own brand colour, not chrome.
const STICKY_TILE = '#ffd43b';
const STICKY_TILE_FOLD = '#f5c500';
// On a dark pill the "Shapes" tile needs a light fill to stay visible.
const SHAPE_TILE = 'var(--cu-text-secondary, #aaaaaa)';

interface ToolDef {
  id: ToolId;
  label: string;
  /** Single-letter keyboard hint shown above the glyph (ClickUp style). */
  hint: string;
  glyph: ReactNode;
}

function Glyph({ d, viewBox = '0 0 24 24' }: { d: string; viewBox?: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const SELECT_GLYPH = (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
    <path
      d="M5 3l6.5 16 2-7 7-2L5 3z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinejoin="round"
    />
  </svg>
);
const HAND_GLYPH = (
  <Glyph d="M8 13V5.5a1.5 1.5 0 013 0V12m0-1.5a1.5 1.5 0 013 0V12m0-1a1.5 1.5 0 013 0v3a6 6 0 01-6 6h-1.5a5 5 0 01-3.6-1.5L7 16l-2-2a1.5 1.5 0 012-2l1 1V8a1.5 1.5 0 013 0" />
);
const TASK_GLYPH = (
  <Glyph d="M4 5h16M4 5v14h16V5M8 10l2 2 4-4" viewBox="0 0 24 24" />
);
const PEN_GLYPH = (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
    <path
      d="M4 20l4-1 9.5-9.5a2 2 0 000-3l-1-1a2 2 0 00-3 0L4 15l-1 4z"
      fill="currentColor"
    />
  </svg>
);
/** Solid dark rounded square tile (real toolbar's "Shapes" glyph). */
const SHAPE_GLYPH = (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
    <rect x="4" y="6" width="16" height="12" rx="2.5" fill={SHAPE_TILE} />
  </svg>
);
const ARROW_GLYPH = (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 20V5M6 11l6-6 6 6" />
  </svg>
);
/** Yellow folded sticky-note tile (real toolbar's coloured "Sticky Note"). */
const STICKY_GLYPH = (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
    <path d="M4 4h12v9l-3 3H4V4z" fill={STICKY_TILE} />
    <path d="M16 13l-3 3v-3h3z" fill={STICKY_TILE_FOLD} />
  </svg>
);
const TEXT_GLYPH = (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
    <path
      d="M5 6h14M12 6v13M9 19h6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const FRAME_GLYPH = (
  <Glyph d="M8 3v18M16 3v18M3 8h18M3 16h18" viewBox="0 0 24 24" />
);
const IMAGE_GLYPH = (
  <Glyph
    d="M4 5h16v14H4zM4 16l4-4 4 4M14 14l2-2 4 4"
    viewBox="0 0 24 24"
  />
);
const CONNECTOR_GLYPH = <Glyph d="M5 19L19 5M5 5h3M16 19h3" />;

/** Select + Hand share a cell, mirroring ClickUp's paired V/H control. */
const POINTER_TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', hint: 'V', glyph: SELECT_GLYPH },
  { id: 'hand', label: 'Hand (pan)', hint: 'H', glyph: HAND_GLYPH },
];

/** Tools after the Task pill, in ClickUp's order. */
const DRAW_TOOLS: ToolDef[] = [
  { id: 'pen', label: 'Draw', hint: 'D', glyph: PEN_GLYPH },
  { id: 'shape', label: 'Shapes', hint: 'R', glyph: SHAPE_GLYPH },
  { id: 'arrow', label: 'Arrow', hint: 'A', glyph: ARROW_GLYPH },
  { id: 'sticky', label: 'Sticky Note', hint: 'N', glyph: STICKY_GLYPH },
  { id: 'text', label: 'Text', hint: 'T', glyph: TEXT_GLYPH },
  { id: 'frame', label: 'Frame', hint: 'F', glyph: FRAME_GLYPH },
  { id: 'image', label: 'Image', hint: '', glyph: IMAGE_GLYPH },
  { id: 'connector', label: 'Templates', hint: '', glyph: CONNECTOR_GLYPH },
];

const TASK_TOOL: ToolDef = {
  id: 'task',
  label: 'ClickUp items',
  hint: 'T',
  glyph: TASK_GLYPH,
};

interface ShapeOption {
  variant: ShapeVariant;
  label: string;
  glyph: ReactNode;
}

const SHAPE_OPTIONS: ShapeOption[] = [
  { variant: 'rect', label: 'Rectangle', glyph: <Glyph d="M4 6h16v12H4z" /> },
  {
    variant: 'ellipse',
    label: 'Ellipse',
    glyph: (
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden
      >
        <ellipse cx="12" cy="12" rx="8" ry="6" />
      </svg>
    ),
  },
  { variant: 'triangle', label: 'Triangle', glyph: <Glyph d="M12 5l8 14H4z" /> },
  {
    variant: 'diamond',
    label: 'Diamond',
    glyph: <Glyph d="M12 4l8 8-8 8-8-8z" />,
  },
];

/** Small uppercase keyboard hint rendered above a tool glyph. */
function Hint({ children }: { children: string }) {
  if (!children) return null;
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: -13,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 9,
        fontWeight: 600,
        lineHeight: 1,
        color: ICON_MUTED,
        pointerEvents: 'none',
      }}
    >
      {children}
    </span>
  );
}

function ToolButton({
  tool,
  active,
  hasFlyout,
  onSelect,
}: {
  tool: ToolDef;
  active: boolean;
  hasFlyout?: boolean;
  onSelect: (id: ToolId) => void;
}) {
  return (
    <button
      type="button"
      title={tool.hint ? `${tool.label} (${tool.hint})` : tool.label}
      aria-label={tool.label}
      aria-pressed={active}
      aria-haspopup={hasFlyout ? 'menu' : undefined}
      onClick={() => onSelect(tool.id)}
      style={{
        position: 'relative',
        width: 36,
        height: 36,
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        color: active ? ACTIVE_FG : ICON,
        background: active ? ACTIVE_BG : 'transparent',
        transition: 'background 120ms ease, color 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = HOVER_BG;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Hint>{tool.hint}</Hint>
      {tool.glyph}
      {hasFlyout ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 3,
            bottom: 3,
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '0 0 5px 5px',
            borderColor: `transparent transparent ${
              active ? ACTIVE_FG : ICON
            } transparent`,
          }}
        />
      ) : null}
    </button>
  );
}

/** Wide pill with the glyph + a "Task" caption + dropdown caret. */
function TaskPill({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: (id: ToolId) => void;
}) {
  return (
    <button
      type="button"
      title="ClickUp items"
      aria-label="ClickUp items"
      aria-pressed={active}
      aria-haspopup="menu"
      onClick={() => onSelect('task')}
      style={{
        position: 'relative',
        height: 36,
        marginTop: 8,
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        cursor: 'pointer',
        color: active ? ACTIVE_FG : ICON,
        background: active ? ACTIVE_BG : 'transparent',
        fontSize: 13,
        fontWeight: 500,
        transition: 'background 120ms ease, color 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = HOVER_BG;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Hint>{TASK_TOOL.hint}</Hint>
      {TASK_TOOL.glyph}
      <span>Task</span>
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
      {/* Blue selected-type accent bar under the pill, like the real toolbar. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 4,
          height: 3,
          borderRadius: 2,
          background: '#4f8bff',
        }}
      />
    </button>
  );
}

function ShapeFlyout({
  current,
  onPick,
}: {
  current: ShapeVariant;
  onPick: (v: ShapeVariant) => void;
}) {
  return (
    <div
      role="menu"
      aria-label="Shapes"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 'calc(100% + 10px)',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        padding: 6,
        borderRadius: 12,
        background: PILL_BG,
        border: `1px solid ${BORDER}`,
        boxShadow: 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,0.6))',
      }}
    >
      {SHAPE_OPTIONS.map((opt) => {
        const isActive = opt.variant === current;
        return (
          <button
            key={opt.variant}
            type="button"
            role="menuitem"
            title={opt.label}
            aria-label={opt.label}
            onClick={() => onPick(opt.variant)}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              color: isActive ? ACTIVE_FG : ICON,
              background: isActive ? ACTIVE_BG : 'transparent',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = HOVER_BG;
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            {opt.glyph}
          </button>
        );
      })}
    </div>
  );
}

/** ClickUp's "AI tools" icon button (colourful sparkle, no text label). */
function AiButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="AI tools"
      aria-label="AI tools"
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id="wb-ai-grad" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#4ecdc4" />
            <stop offset="50%" stopColor="#f59f00" />
            <stop offset="100%" stopColor="#ff6b6b" />
          </linearGradient>
        </defs>
        <path
          fill="url(#wb-ai-grad)"
          d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zM18 14l.9 2.6L21.5 17.5l-2.6.9L18 21l-.9-2.6L14.5 17.5l2.6-.9L18 14z"
        />
      </svg>
    </button>
  );
}

function HistoryButton({
  label,
  d,
  disabled,
  onClick,
}: {
  label: string;
  d: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--cu-text-disabled, #5a5e68)' : ICON,
        background: 'transparent',
        transition: 'background 120ms ease, color 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = HOVER_BG;
      }}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={d} />
      </svg>
    </button>
  );
}

const UNDO_D = 'M9 14l-4-4 4-4M5 10h11a4 4 0 014 4v0a4 4 0 01-4 4H8';
const REDO_D = 'M15 14l4-4-4-4M19 10H8a4 4 0 00-4 4v0a4 4 0 004 4h8';

function Divider() {
  return (
    <span
      aria-hidden
      style={{
        width: 1,
        height: 28,
        margin: '8px 4px 0',
        background: DIVIDER,
      }}
    />
  );
}

export function WhiteboardToolbar({
  activeTool,
  shapeVariant,
  onSelectTool,
  onSelectShape,
  onAi,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  activeTool: ToolId;
  shapeVariant: ShapeVariant;
  onSelectTool: (id: ToolId) => void;
  onSelectShape: (v: ShapeVariant) => void;
  onAi: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!flyoutOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFlyoutOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFlyoutOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [flyoutOpen]);

  // Close the flyout once the parent resets the active tool after a placement
  // (onToolUsed flips activeTool back to 'select'), or when any non-shape tool
  // becomes active. Without this the flyout lingers until an outside click.
  useEffect(() => {
    if (activeTool !== 'shape' && !isShapeVariant(activeTool)) {
      setFlyoutOpen(false);
    }
  }, [activeTool]);

  const shapeActive = activeTool === 'shape' || isShapeVariant(activeTool);

  const handleShapeClick = () => {
    onSelectTool(shapeVariant);
    setFlyoutOpen((open) => !open);
  };

  const handlePickShape = (v: ShapeVariant) => {
    onSelectShape(v);
    onSelectTool(v);
    setFlyoutOpen(false);
  };

  return (
    <div
      role="toolbar"
      aria-label="Whiteboard tools"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 6px 6px',
        borderRadius: 14,
        background: PILL_BG,
        border: `1px solid ${BORDER}`,
        boxShadow: 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,0.6))',
        zIndex: 20,
      }}
    >
      {POINTER_TOOLS.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={activeTool === tool.id}
          onSelect={onSelectTool}
        />
      ))}

      <Divider />

      <TaskPill active={activeTool === 'task'} onSelect={onSelectTool} />

      <Divider />

      {DRAW_TOOLS.map((tool) => {
        if (tool.id === 'shape') {
          return (
            <div key="shape" ref={wrapRef} style={{ position: 'relative' }}>
              <ToolButton
                tool={tool}
                active={shapeActive}
                hasFlyout
                onSelect={handleShapeClick}
              />
              {flyoutOpen ? (
                <ShapeFlyout current={shapeVariant} onPick={handlePickShape} />
              ) : null}
            </div>
          );
        }
        return (
          <ToolButton
            key={tool.id}
            tool={tool}
            active={activeTool === tool.id}
            onSelect={onSelectTool}
          />
        );
      })}

      <AiButton onClick={onAi} />

      <Divider />

      <HistoryButton
        label="Undo"
        d={UNDO_D}
        disabled={!canUndo}
        onClick={onUndo}
      />
      <HistoryButton
        label="Redo"
        d={REDO_D}
        disabled={!canRedo}
        onClick={onRedo}
      />
    </div>
  );
}
