'use client';

import { useEffect, useRef, useState } from 'react';
import type { BlockType } from './block-insert';
import {
  TableBlockIcon,
  ColumnsBlockIcon,
  ListEmbedIcon,
  SubpageIcon,
} from './doc-icons';
import { DOC } from './tokens';

interface SlashOption {
  block: BlockType;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

const OPTIONS: SlashOption[] = [
  { block: 'heading', label: 'Heading', hint: 'Big section heading', icon: <Glyph>H1</Glyph> },
  { block: 'bullet', label: 'Bulleted list', hint: 'A simple bullet list', icon: <Glyph>•</Glyph> },
  { block: 'numbered', label: 'Numbered list', hint: 'An ordered list', icon: <Glyph>1.</Glyph> },
  { block: 'checklist', label: 'To-do', hint: 'Track tasks with a checkbox', icon: <Glyph>☑</Glyph> },
  { block: 'quote', label: 'Quote', hint: 'Capture a quote', icon: <Glyph>❝</Glyph> },
  { block: 'divider', label: 'Divider', hint: 'Visually divide blocks', icon: <Glyph>—</Glyph> },
  { block: 'table', label: 'Table', hint: 'Add a simple table', icon: <TableBlockIcon size={16} /> },
  { block: 'columns', label: 'Column', hint: 'Side-by-side columns', icon: <ColumnsBlockIcon size={16} /> },
  { block: 'list', label: 'ClickUp List', hint: 'Embed a task list', icon: <ListEmbedIcon size={16} /> },
  { block: 'subpage', label: 'Subpage', hint: 'Add a nested page', icon: <SubpageIcon size={16} /> },
];

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: DOC.textSecondary }}>{children}</span>
  );
}

/**
 * "/" slash menu offered when the caret sits on an empty line. Filters block
 * types by the typed query, supports arrow-key navigation + Enter/Escape, and
 * inserts the chosen block via `onSelect`. Positioned absolutely at the caret
 * coordinates supplied by the editor.
 */
export function SlashMenu({
  query,
  top,
  left,
  onSelect,
  onClose,
}: {
  query: string;
  top: number;
  left: number;
  onSelect: (block: BlockType) => void;
  onClose: () => void;
}) {
  const filtered = OPTIONS.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset highlight whenever the result set changes so a stale index never
  // points past the end of the filtered list.
  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (filtered.length === 0) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const opt = filtered[index];
        if (opt) onSelect(opt.block);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [filtered, index, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      data-testid="doc-slash-menu"
      role="listbox"
      style={{
        position: 'absolute',
        top,
        left,
        zIndex: 40,
        width: 280,
        maxHeight: 320,
        overflowY: 'auto',
        background: DOC.menuBg,
        border: `1px solid ${DOC.border}`,
        borderRadius: 10,
        boxShadow: 'var(--cu-shadow-lg)',
        padding: '6px 0',
      }}
    >
      {filtered.map((opt, i) => (
        <SlashRow
          key={opt.block}
          option={opt}
          active={i === index}
          onMouseEnter={() => setIndex(i)}
          onClick={() => onSelect(opt.block)}
        />
      ))}
    </div>
  );
}

function SlashRow({
  option,
  active,
  onMouseEnter,
  onClick,
}: {
  option: SlashOption;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      // mousedown rather than click: the editor textarea would blur first and
      // tear the menu down before a click landed.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '6px 12px',
        minHeight: 38,
        background: active ? DOC.hover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        color: DOC.textPrimary,
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: DOC.input,
          border: `1px solid ${DOC.border}`,
          borderRadius: 6,
          color: DOC.textSecondary,
        }}
      >
        {option.icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{option.label}</span>
        <span style={{ fontSize: 11, color: DOC.textMuted }}>{option.hint}</span>
      </span>
    </button>
  );
}
