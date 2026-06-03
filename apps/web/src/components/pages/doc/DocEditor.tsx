'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { buildBlock, type BlockType } from './block-insert';
import { caretCoordinates } from './caret-coords';
import { SlashMenu } from './SlashMenu';
import { DOC } from './tokens';

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'code'
  | 'h1'
  | 'h2'
  | 'bullet'
  | 'numbered'
  | 'quote';

interface Selection {
  start: number;
  end: number;
}

interface SlashState {
  /** Caret offset where the "/" sits (start of the trigger token). */
  from: number;
  /** Text typed after the "/" (used to filter block options). */
  query: string;
  top: number;
  left: number;
}

/** Imperative surface the parent uses to push generated content (AI / starters). */
export interface DocEditorHandle {
  focus: () => void;
  /** Append text to the body and place the caret at the end. */
  appendText: (text: string) => void;
}

/**
 * Editable raw-markdown surface for a doc page. Styled to match the doc reading
 * column so editing feels inline. Two affordances layer over the textarea:
 *   - a floating format toolbar over the current selection (bold/italic/…); and
 *   - a "/" slash menu when the caret sits on an empty line, inserting blocks.
 *
 * Inline block inserts (table, list, heading, …) rewrite the markdown locally.
 * Tree-affecting inserts (subpage) defer to `onBlockSideEffect` so the parent
 * can mint a real tree node, then the returned name seeds the inserted block.
 */
export const DocEditor = forwardRef<DocEditorHandle, {
  value: string;
  onChange: (next: string) => void;
  /** Optional side-effect for blocks that touch app state (returns block label). */
  onBlockSideEffect?: (block: BlockType) => string | undefined;
}>(function DocEditor({ value, onChange, onBlockSideEffect }, handleRef) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);

  useImperativeHandle(
    handleRef,
    () => ({
      focus: () => ref.current?.focus(),
      appendText: (text: string) => {
        const base = value.replace(/\s+$/, '');
        const next = base.length ? `${base}\n\n${text}` : text;
        onChange(next);
        requestAnimationFrame(() => {
          const el = ref.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(next.length, next.length);
          resize();
        });
      },
    }),
    // resize is stable; value/onChange tracked so appended content is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, onChange],
  );

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const updateToolbar = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.selectionStart === el.selectionEnd) {
      setToolbar(null);
      return;
    }
    // KNOWN CONSTRAINT: the toolbar anchors to the textarea's top-left rather
    // than the caret rect (textareas expose no per-selection rect). For long
    // docs the bar may scroll out of view. Accepted trade-off vs moving the
    // whole editor to contentEditable.
    setToolbar({ top: -44, left: 0 });
  }, []);

  // Detect a "/" slash trigger: the caret must sit at the end of a token that
  // starts with "/" on an otherwise-empty line (start-of-line or after a blank).
  const detectSlash = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart;
    if (pos !== el.selectionEnd) {
      setSlash(null);
      return;
    }
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
    const line = value.slice(lineStart, pos);
    const match = /^\/([\w]*)$/.exec(line);
    if (!match) {
      setSlash(null);
      return;
    }
    const { top, left } = caretCoordinates(el, lineStart);
    setSlash({ from: lineStart, query: match[1] ?? '', top: top + 22, left });
  }, [value]);

  const applyFormat = useCallback(
    (action: FormatAction) => {
      if (blurTimer.current) {
        clearTimeout(blurTimer.current);
        blurTimer.current = null;
      }
      const el = ref.current;
      if (!el) return;
      const sel: Selection = { start: el.selectionStart, end: el.selectionEnd };
      const next = transform(value, sel, action);
      onChange(next.text);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.selStart, next.selEnd);
        resize();
      });
    },
    [value, onChange, resize],
  );

  const insertSlashBlock = useCallback(
    (block: BlockType) => {
      const current = slash;
      if (!current) return;
      const label = onBlockSideEffect?.(block);
      const snippet = buildBlock(block, label);
      const before = value.slice(0, current.from);
      const after = value.slice(current.from + 1 + current.query.length);
      const next = `${before}${snippet.markdown}${after}`;
      onChange(next);
      setSlash(null);
      const caret = before.length + snippet.markdown.length;
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
        resize();
      });
    },
    [slash, value, onChange, onBlockSideEffect, resize],
  );

  return (
    <div style={{ position: 'relative' }}>
      {toolbar && (
        <FormatToolbar top={toolbar.top} left={toolbar.left} onAction={applyFormat} />
      )}
      {slash && (
        <SlashMenu
          query={slash.query}
          top={slash.top}
          left={slash.left}
          onSelect={insertSlashBlock}
          onClose={() => setSlash(null)}
        />
      )}
      <textarea
        ref={ref}
        data-testid="doc-editor"
        value={value}
        spellCheck
        onChange={(e) => {
          onChange(e.target.value);
          resize();
        }}
        onSelect={() => {
          updateToolbar();
          detectSlash();
        }}
        onKeyUp={detectSlash}
        onClick={detectSlash}
        onBlur={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          blurTimer.current = setTimeout(() => {
            setToolbar(null);
            setSlash(null);
          }, 150);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            applyFormat('bold');
          } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            applyFormat('italic');
          }
        }}
        placeholder="Type '/' for blocks, or just start writing…"
        style={{
          width: '100%',
          minHeight: 240,
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: DOC.textPrimary,
          fontFamily: DOC.headingFont,
          fontSize: 15,
          lineHeight: 1.65,
          padding: 0,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
});

const TOOLBAR_BUTTONS: { action: FormatAction; label: string; title: string }[] = [
  { action: 'bold', label: 'B', title: 'Bold (⌘B)' },
  { action: 'italic', label: 'I', title: 'Italic (⌘I)' },
  { action: 'code', label: '</>', title: 'Inline code' },
  { action: 'h1', label: 'H1', title: 'Heading 1' },
  { action: 'h2', label: 'H2', title: 'Heading 2' },
  { action: 'bullet', label: '•', title: 'Bullet list' },
  { action: 'numbered', label: '1.', title: 'Numbered list' },
  { action: 'quote', label: '❝', title: 'Quote' },
];

function FormatToolbar({
  top,
  left,
  onAction,
}: {
  top: number;
  left: number;
  onAction: (a: FormatAction) => void;
}) {
  return (
    <div
      data-testid="doc-format-toolbar"
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(e) => e.preventDefault()} // keep textarea selection
      style={{
        position: 'absolute',
        top,
        left,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 34,
        padding: '0 4px',
        background: DOC.menuBg,
        border: `1px solid ${DOC.border}`,
        borderRadius: 8,
        boxShadow: 'var(--cu-shadow-lg)',
      }}
    >
      {TOOLBAR_BUTTONS.map((b, i) => (
        <span key={b.action} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {(i === 3 || i === 5) && (
            <span style={{ width: 1, height: 18, background: DOC.border, margin: '0 4px' }} />
          )}
          <ToolbarButton {...b} onAction={onAction} />
        </span>
      ))}
    </div>
  );
}

function ToolbarButton({
  action,
  label,
  title,
  onAction,
}: {
  action: FormatAction;
  label: string;
  title: string;
  onAction: (a: FormatAction) => void;
}) {
  const [hover, setHover] = useState(false);
  const italic = action === 'italic';
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onAction(action)}
      style={{
        minWidth: 26,
        height: 26,
        padding: '0 6px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? DOC.hover : 'transparent',
        border: 'none',
        borderRadius: 5,
        cursor: 'pointer',
        color: DOC.textPrimary,
        fontSize: 13,
        fontWeight: action === 'bold' ? 800 : 600,
        fontStyle: italic ? 'italic' : 'normal',
        fontFamily: action === 'code' ? 'ui-monospace, monospace' : 'inherit',
      }}
    >
      {label}
    </button>
  );
}

interface TransformResult {
  text: string;
  selStart: number;
  selEnd: number;
}

/** Apply a markdown transform to the selected range of `text`. */
function transform(text: string, sel: Selection, action: FormatAction): TransformResult {
  const before = text.slice(0, sel.start);
  const selected = text.slice(sel.start, sel.end);
  const after = text.slice(sel.end);

  if (action === 'bold' || action === 'italic' || action === 'code') {
    const wrap = action === 'bold' ? '**' : action === 'italic' ? '_' : '`';
    const wrapped = `${wrap}${selected}${wrap}`;
    return {
      text: before + wrapped + after,
      selStart: sel.start + wrap.length,
      selEnd: sel.end + wrap.length,
    };
  }

  const prefix =
    action === 'h1'
      ? '# '
      : action === 'h2'
        ? '## '
        : action === 'bullet'
          ? '- '
          : action === 'quote'
            ? '> '
            : '';

  const lineStart = text.lastIndexOf('\n', sel.start - 1) + 1;
  const head = text.slice(0, lineStart);
  const body = text.slice(lineStart, sel.end);
  const tail = text.slice(sel.end);
  const lines = body.split('\n');

  const transformed =
    action === 'numbered'
      ? lines.map((ln, idx) => `${idx + 1}. ${stripPrefix(ln)}`)
      : lines.map((ln) => `${prefix}${stripPrefix(ln)}`);

  const joined = transformed.join('\n');
  return {
    text: head + joined + tail,
    selStart: lineStart,
    selEnd: lineStart + joined.length,
  };
}

/** Remove an existing block prefix so toggles don't stack. */
function stripPrefix(line: string): string {
  return line.replace(/^(#{1,3}\s+|[-*]\s+|\d+\.\s+|>\s?)/, '');
}
