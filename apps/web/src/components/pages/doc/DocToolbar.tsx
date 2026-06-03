'use client';

import { forwardRef, useState } from 'react';
import {
  Menu,
  MenuHeading,
  MenuItem,
  MenuDivider,
  MenuToggle,
} from '@/components/ui/Menu';
import {
  CommentBubbleIcon,
  TypographyIcon,
  RelationshipsIcon,
  TemplatesIcon,
  DownloadIcon,
  AskAiIcon,
} from './doc-icons';
import { DOC } from './tokens';

/** Page-width preset used by the Page Styles popover (controls reading column). */
export type DocWidth = 'small' | 'default' | 'large';

/**
 * Right-edge vertical rail from ClickUp's doc reader. The real rail, top→bottom:
 *   Comments · Page Styles (Aa) · Relationships · Templates · Export
 * plus a separate floating "Ask about this Doc" AI button anchored bottom-right.
 *
 * Each control opens a REAL popover built on the shared `Menu` primitive — no
 * dead buttons. Leaf actions an offline clone can't perform surface a transient
 * toast via the parent, never a no-op.
 */
export function DocToolbar({
  width,
  onWidthChange,
  serif,
  onSerifChange,
  onComment,
  onAiWrite,
  onRelationships,
  onInsertTemplate,
  onDownload,
}: {
  width: DocWidth;
  onWidthChange: (w: DocWidth) => void;
  serif: boolean;
  onSerifChange: (next: boolean) => void;
  onComment: () => void;
  onAiWrite: (prompt: string) => void;
  onRelationships: () => void;
  onInsertTemplate: (name: string) => void;
  onDownload: (format: 'markdown' | 'html' | 'pdf') => void;
}) {
  return (
    <>
      <div
        data-testid="doc-toolbar"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          zIndex: 20,
        }}
      >
        <ToolbarButton
          label="Comments"
          testid="doc-tool-comment"
          onClick={onComment}
        >
          <CommentBubbleIcon size={18} />
        </ToolbarButton>

        <PageStylesButton
          width={width}
          onWidthChange={onWidthChange}
          serif={serif}
          onSerifChange={onSerifChange}
        />

        <RelationshipsButton onRelationships={onRelationships} />

        <TemplatesButton onInsertTemplate={onInsertTemplate} />

        <ExportButton onDownload={onDownload} />
      </div>

      <AskAiButton onAiWrite={onAiWrite} />
    </>
  );
}

function ToolbarButton({
  label,
  testid,
  onClick,
  children,
}: {
  label: string;
  testid?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={railButtonStyle(hover, false)}
    >
      {children}
    </button>
  );
}

function railButtonStyle(active: boolean, open: boolean): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active || open ? DOC.hover : 'transparent',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    color: open ? DOC.textPrimary : DOC.textSecondary,
    transition: 'background 120ms ease, color 120ms ease',
  };
}

interface MenuTriggerProps {
  label: string;
  testid?: string;
  open: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

/** Trigger that reuses the rail button styling inside a Menu render-prop. */
const MenuTriggerButton = forwardRef<HTMLButtonElement, MenuTriggerProps>(
  function MenuTriggerButton({ label, testid, open, onClick, children }, ref) {
    const [hover, setHover] = useState(false);
    return (
      <button
        ref={ref}
        type="button"
        data-testid={testid}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={railButtonStyle(hover, open)}
      >
        {children}
      </button>
    );
  },
);

const WIDTH_LABELS: Record<DocWidth, string> = {
  small: 'Small',
  default: 'Default',
  large: 'Large',
};

function PageStylesButton({
  width,
  onWidthChange,
  serif,
  onSerifChange,
}: {
  width: DocWidth;
  onWidthChange: (w: DocWidth) => void;
  serif: boolean;
  onSerifChange: (next: boolean) => void;
}) {
  return (
    <Menu
      width={232}
      align="right"
      placement="below"
      trigger={({ ref, onClick, open }) => (
        <MenuTriggerButton
          ref={ref}
          label="Page Styles"
          testid="doc-tool-page-styles"
          open={open}
          onClick={onClick}
        >
          <TypographyIcon size={18} />
        </MenuTriggerButton>
      )}
    >
      <MenuHeading>Page width</MenuHeading>
      {(['small', 'default', 'large'] as DocWidth[]).map((w) => (
        <MenuItem
          key={w}
          label={WIDTH_LABELS[w]}
          postscript={width === w ? '✓' : undefined}
          onSelect={() => onWidthChange(w)}
        />
      ))}
      <MenuDivider />
      <MenuHeading>Font</MenuHeading>
      <MenuToggle label="Serif" checked={serif} onChange={onSerifChange} />
    </Menu>
  );
}

function RelationshipsButton({
  onRelationships,
}: {
  onRelationships: () => void;
}) {
  return (
    <Menu
      width={236}
      align="right"
      placement="below"
      trigger={({ ref, onClick, open }) => (
        <MenuTriggerButton
          ref={ref}
          label="Relationships"
          testid="doc-tool-relationships"
          open={open}
          onClick={onClick}
        >
          <RelationshipsIcon size={18} />
        </MenuTriggerButton>
      )}
    >
      <MenuHeading>Relationships</MenuHeading>
      <MenuItem label="Link Task or Doc" onSelect={onRelationships} />
      <MenuItem label="Add to Task" onSelect={onRelationships} />
      <MenuItem label="Convert to Task" onSelect={onRelationships} />
    </Menu>
  );
}

const TEMPLATES = [
  'Meeting Notes',
  'Project Brief',
  'Product Spec',
  'Weekly Update',
  'Knowledge Base',
] as const;

function TemplatesButton({
  onInsertTemplate,
}: {
  onInsertTemplate: (name: string) => void;
}) {
  return (
    <Menu
      width={236}
      align="right"
      placement="below"
      trigger={({ ref, onClick, open }) => (
        <MenuTriggerButton
          ref={ref}
          label="Templates"
          testid="doc-tool-templates"
          open={open}
          onClick={onClick}
        >
          <TemplatesIcon size={18} />
        </MenuTriggerButton>
      )}
    >
      <MenuHeading>Use a template</MenuHeading>
      {TEMPLATES.map((name) => (
        <MenuItem
          key={name}
          label={name}
          onSelect={() => onInsertTemplate(name)}
        />
      ))}
    </Menu>
  );
}

function ExportButton({
  onDownload,
}: {
  onDownload: (format: 'markdown' | 'html' | 'pdf') => void;
}) {
  return (
    <Menu
      width={200}
      align="right"
      placement="below"
      trigger={({ ref, onClick, open }) => (
        <MenuTriggerButton
          ref={ref}
          label="Export"
          testid="doc-tool-export"
          open={open}
          onClick={onClick}
        >
          <DownloadIcon size={18} />
        </MenuTriggerButton>
      )}
    >
      <MenuHeading>Export</MenuHeading>
      <MenuItem label="PDF" onSelect={() => onDownload('pdf')} />
      <MenuItem label="Markdown" onSelect={() => onDownload('markdown')} />
      <MenuItem label="HTML" onSelect={() => onDownload('html')} />
    </Menu>
  );
}

const AI_PURPLE = 'rgb(168,110,255)';

function AskAiButton({ onAiWrite }: { onAiWrite: (prompt: string) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <Menu
      width={300}
      align="right"
      placement="above"
      surfaceStyle={{ padding: 12 }}
      trigger={({ ref, onClick, open }) => (
        <button
          ref={ref}
          type="button"
          data-testid="doc-ask-ai"
          aria-label="Ask about this Doc"
          aria-expanded={open}
          title="Ask about this Doc"
          onClick={onClick}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            zIndex: 21,
            width: 38,
            height: 38,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: DOC.menuBg,
            border: `1px solid ${DOC.border}`,
            borderRadius: 10,
            cursor: 'pointer',
            color: AI_PURPLE,
            boxShadow:
              hover || open
                ? '0 6px 18px rgba(0,0,0,.28)'
                : '0 2px 8px rgba(0,0,0,.2)',
            transition: 'box-shadow 140ms ease',
          }}
        >
          <AskAiIcon size={20} />
        </button>
      )}
    >
      <AiPopover onAiWrite={onAiWrite} />
    </Menu>
  );
}

function AiPopover({ onAiWrite }: { onAiWrite: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState('');
  return (
    <div
      data-testid="doc-ai-popover"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: DOC.textPrimary,
        }}
      >
        <span style={{ color: AI_PURPLE }}>
          <AskAiIcon size={16} />
        </span>
        Ask about this Doc
      </div>
      <textarea
        value={prompt}
        autoFocus
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && prompt.trim()) {
            e.preventDefault();
            onAiWrite(prompt.trim());
            setPrompt('');
          }
        }}
        placeholder="Ask AI to write or summarise anything…"
        style={{
          width: '100%',
          minHeight: 64,
          resize: 'vertical',
          padding: '8px 10px',
          background: DOC.input,
          border: `1px solid ${DOC.border}`,
          borderRadius: 8,
          color: DOC.textPrimary,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        disabled={!prompt.trim()}
        onClick={() => {
          if (!prompt.trim()) return;
          onAiWrite(prompt.trim());
          setPrompt('');
        }}
        style={{
          height: 32,
          background: prompt.trim() ? AI_PURPLE : DOC.input,
          color: prompt.trim() ? '#fff' : DOC.textMuted,
          border: 'none',
          borderRadius: 8,
          cursor: prompt.trim() ? 'pointer' : 'default',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
        }}
      >
        Generate
      </button>
    </div>
  );
}
