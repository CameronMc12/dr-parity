'use client';

/**
 * First-open "Choose a structure that works for you" screen for the Mind Map.
 * Two cards — Tasks (visualise existing folders/lists/tasks) and Freeform
 * (brainstorm on a blank canvas) — each with a mini illustration and a real
 * button that commits the choice. Mirrors ClickUp's official structure picker.
 */

import { useState } from 'react';
import type { MindStructure } from './use-structure';

const PANEL_BG = 'var(--cu-bg-app, rgb(20,20,20))';
const CARD_BG = 'var(--cu-bg-menu, rgb(34,34,34))';
const CARD_BORDER = 'var(--cu-border-divider, rgba(255,255,255,0.10))';
const CARD_BORDER_HOVER = 'var(--cu-border-strong, rgba(255,255,255,0.22))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(217,217,217))';
const TEXT_SECONDARY = 'var(--cu-text-secondary, rgb(160,160,160))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(120,120,120))';
const ACCENT = 'var(--cu-accent, #4ecdc4)';
const ILLO_BG = 'var(--cu-bg-app, rgb(20,20,20))';
const BTN_TEXT = 'var(--cu-text-primary, rgb(245,245,245))';

interface Props {
  onChoose: (next: MindStructure) => void;
}

export function StructureChooser({ onChoose }: Props) {
  return (
    <div
      data-testid="mindmap-chooser"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        padding: 24,
        background: PANEL_BG,
        overflow: 'auto',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            color: TEXT_PRIMARY,
          }}
        >
          Choose a structure that works for you
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: TEXT_MUTED }}>
          You can switch the structure at any time.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <ChoiceCard
          testid="mindmap-choose-tasks"
          title="Tasks"
          description="Visualize your folders, lists, and tasks in a clear, structured view."
          buttonLabel="Tasks"
          illustration={<TasksIllustration />}
          onClick={() => onChoose('tasks')}
        />
        <ChoiceCard
          testid="mindmap-choose-freeform"
          title="Freeform"
          description="Brainstorm ideas and create new Tasks from a blank canvas."
          buttonLabel="Freeform"
          illustration={<FreeformIllustration />}
          onClick={() => onChoose('freeform')}
        />
      </div>
    </div>
  );
}

interface CardProps {
  testid: string;
  title: string;
  description: string;
  buttonLabel: string;
  illustration: React.ReactNode;
  onClick: () => void;
}

function ChoiceCard({
  testid,
  title,
  description,
  buttonLabel,
  illustration,
  onClick,
}: CardProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      data-testid={testid}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 280,
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        background: CARD_BG,
        border: `1px solid ${hover ? CARD_BORDER_HOVER : CARD_BORDER}`,
        borderRadius: 12,
        boxShadow: hover
          ? '0 8px 28px rgba(0,0,0,0.45)'
          : '0 1px 3px rgba(0,0,0,0.35)',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform 120ms, box-shadow 120ms, border-color 120ms',
      }}
    >
      <div
        aria-hidden
        style={{
          height: 132,
          borderRadius: 8,
          background: ILLO_BG,
          border: `1px solid ${CARD_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {illustration}
      </div>

      <h3
        style={{
          margin: '16px 0 0',
          fontSize: 15,
          fontWeight: 600,
          color: TEXT_PRIMARY,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: '6px 0 16px',
          fontSize: 13,
          lineHeight: 1.5,
          color: TEXT_SECONDARY,
          flex: 1,
        }}
      >
        {description}
      </p>

      <button
        type="button"
        onClick={onClick}
        style={{
          height: 36,
          borderRadius: 8,
          border: 'none',
          background: ACCENT,
          color: BTN_TEXT,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'filter 120ms',
          filter: hover ? 'brightness(1.08)' : 'none',
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

/** Mini task-tree: a root node branching into two children, one with a leaf. */
function TasksIllustration() {
  const node = 'var(--cu-bg-menu, rgb(46,46,46))';
  const line = 'var(--cu-border-strong, rgba(255,255,255,0.28))';
  const dot = ACCENT;
  return (
    <svg width={172} height={110} viewBox="0 0 172 110" fill="none" aria-hidden>
      <path
        d="M52 55 C70 55 70 30 88 30 M52 55 C70 55 70 80 88 80 M120 80 C134 80 134 95 148 95"
        stroke={line}
        strokeWidth={1.5}
        fill="none"
      />
      <Pill x={12} y={44} w={40} fill={node} dot={dot} />
      <Pill x={88} y={19} w={40} fill={node} dot={dot} />
      <Pill x={88} y={69} w={40} fill={node} dot={dot} />
      <Pill x={140} y={86} w={26} fill={node} dot={dot} />
    </svg>
  );
}

/** Blank-canvas hint: scattered free nodes connected by loose curves. */
function FreeformIllustration() {
  const node = 'var(--cu-bg-menu, rgb(46,46,46))';
  const line = 'var(--cu-border-strong, rgba(255,255,255,0.22))';
  return (
    <svg width={172} height={110} viewBox="0 0 172 110" fill="none" aria-hidden>
      <path
        d="M48 30 C70 36 92 22 116 34 M44 70 C66 64 96 78 124 70 M58 46 C64 56 60 62 70 70"
        stroke={line}
        strokeWidth={1.5}
        strokeDasharray="4 5"
        fill="none"
      />
      <FreeNode cx={36} cy={28} />
      <FreeNode cx={128} cy={34} />
      <FreeNode cx={32} cy={72} />
      <FreeNode cx={134} cy={70} />
      <FreeNode cx={78} cy={50} accent />
    </svg>
  );
}

function Pill({
  x,
  y,
  w,
  fill,
  dot,
}: {
  x: number;
  y: number;
  w: number;
  fill: string;
  dot: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={22} rx={5} fill={fill} />
      <circle cx={x + 9} cy={y + 11} r={3} fill={dot} />
    </g>
  );
}

function FreeNode({
  cx,
  cy,
  accent,
}: {
  cx: number;
  cy: number;
  accent?: boolean;
}) {
  const fill = accent ? ACCENT : 'var(--cu-bg-menu, rgb(46,46,46))';
  return (
    <g>
      <rect x={cx - 16} y={cy - 9} width={32} height={18} rx={9} fill={fill} />
    </g>
  );
}
