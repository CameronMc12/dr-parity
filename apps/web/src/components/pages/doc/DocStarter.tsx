'use client';

import { useState } from 'react';
import type { BlockType } from './block-insert';
import {
  PenIcon,
  WikiIcon,
  SparkleIcon,
  TableBlockIcon,
  ColumnsBlockIcon,
  ListEmbedIcon,
  SubpageIcon,
} from './doc-icons';
import { DOC } from './tokens';

type StarterAction =
  | { kind: 'write' }
  | { kind: 'wiki' }
  | { kind: 'ai' }
  | { kind: 'block'; block: BlockType };

/**
 * Empty-page starter shown when a doc page has no content yet. Matches ClickUp's
 * `cu-dropdown-list` anatomy 1:1: plain single-line rows with a small inline
 * icon, no boxed chips and no description sub-text. Top group: Start writing,
 * Blank wiki, Write with AI. Then a faded "Add new" label and the block-insert
 * group: Table, Column, ClickUp List, Subpage. Selecting a row calls back into
 * `DocView`, which inserts the block / focuses the editor / opens the AI popover.
 */
export function DocStarter({
  onStartWriting,
  onBlankWiki,
  onWriteWithAi,
  onInsertBlock,
}: {
  onStartWriting: () => void;
  onBlankWiki: () => void;
  onWriteWithAi: () => void;
  onInsertBlock: (block: BlockType) => void;
}) {
  const run = (action: StarterAction) => {
    switch (action.kind) {
      case 'write':
        return onStartWriting();
      case 'wiki':
        return onBlankWiki();
      case 'ai':
        return onWriteWithAi();
      case 'block':
        return onInsertBlock(action.block);
    }
  };

  return (
    <div data-testid="doc-starter" style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <StarterRow
          icon={<PenIcon size={16} />}
          label="Start writing"
          onClick={() => run({ kind: 'write' })}
          testid="doc-starter-write"
        />
        <StarterRow
          icon={<WikiIcon size={16} />}
          label="Blank wiki"
          onClick={() => run({ kind: 'wiki' })}
          testid="doc-starter-wiki"
        />
        <StarterRow
          icon={
            <span style={{ color: 'rgb(168,110,255)' }}>
              <SparkleIcon size={16} />
            </span>
          }
          label="Write with AI"
          onClick={() => run({ kind: 'ai' })}
          testid="doc-starter-ai"
        />
      </div>

      <GroupLabel>Add new</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <StarterRow
          icon={<TableBlockIcon size={16} />}
          label="Table"
          onClick={() => run({ kind: 'block', block: 'table' })}
          testid="doc-starter-table"
        />
        <StarterRow
          icon={<ColumnsBlockIcon size={16} />}
          label="Column"
          onClick={() => run({ kind: 'block', block: 'columns' })}
          testid="doc-starter-column"
        />
        <StarterRow
          icon={<ListEmbedIcon size={16} />}
          label="ClickUp List"
          onClick={() => run({ kind: 'block', block: 'list' })}
          testid="doc-starter-list"
        />
        <StarterRow
          icon={<SubpageIcon size={16} />}
          label="Subpage"
          onClick={() => run({ kind: 'block', block: 'subpage' })}
          testid="doc-starter-subpage"
        />
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: '14px 0 2px',
        padding: '0 8px',
        fontSize: 13,
        fontWeight: 400,
        color: DOC.textMuted,
      }}
    >
      {children}
    </div>
  );
}

function StarterRow({
  icon,
  label,
  onClick,
  testid,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  testid?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 32,
        padding: '0 8px',
        background: hover ? DOC.hover : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
        color: DOC.textSecondary,
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: DOC.textMuted,
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 14, fontWeight: 400 }}>{label}</span>
    </button>
  );
}
