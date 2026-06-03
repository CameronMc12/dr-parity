'use client';

/**
 * Full-width "create task" row pinned to the bottom of the Table grid (ClickUp's
 * `cu-create-row-renderer`). A leading "+" sits in the `#` column; typing in the
 * Name field and pressing Enter writes a real task via the store, then keeps
 * focus for rapid entry. Spans the whole grid width like the real grid's last
 * row.
 */

import { useState } from 'react';
import { PlusCircle } from '@/components/pages/list-view-icons';
import { TBL, NUM_WIDTH, CREATE_ROW_HEIGHT } from './tokens';

export function CreateRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    onAdd(name);
    setDraft('');
  };

  return (
    <div
      data-testid="tbl-create-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: CREATE_ROW_HEIGHT,
        borderBottom: `1px solid ${TBL.gridline}`,
        background: focused ? TBL.hover : 'transparent',
        transition: 'background 120ms',
      }}
    >
      <div
        style={{
          width: NUM_WIDTH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: TBL.textMuted,
          flexShrink: 0,
        }}
      >
        <PlusCircle size={16} />
      </div>
      <input
        data-testid="tbl-create-row-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            setDraft('');
            e.currentTarget.blur();
          }
        }}
        placeholder="Add Task"
        aria-label="Add Task"
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          border: 'none',
          outline: 'none',
          fontSize: 13,
          color: focused || draft ? TBL.textPrimary : TBL.textMuted,
          background: 'transparent',
          fontFamily: 'inherit',
          paddingRight: 12,
        }}
      />
    </div>
  );
}
