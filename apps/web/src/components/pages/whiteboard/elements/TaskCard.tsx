'use client';

/**
 * A board task card (placed by the Task tool). Mirrors a ClickUp task card: a
 * status pill, an editable title, and a priority flag dot. Plain presentational;
 * drag/select/edit wiring lives in the canvas via the props below.
 */

import { useEffect, useRef } from 'react';
import type { TaskCardElement } from '../types';

export function TaskCard({
  el,
  editing,
  onChangeText,
}: {
  el: TaskCardElement;
  editing: boolean;
  onChangeText: (text: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#fff',
        borderRadius: 8,
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 4px 12px rgba(15,23,42,0.14)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 18,
            padding: '0 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.4,
            color: '#fff',
            background: el.statusColor,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {el.status}
        </span>
        {el.priorityColor ? (
          <svg width={12} height={12} viewBox="0 0 24 24" aria-hidden>
            <path
              d="M5 3v18M5 4h11l-2 4 2 4H5"
              fill={el.priorityColor}
              stroke={el.priorityColor}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </div>

      {editing ? (
        <textarea
          ref={ref}
          value={el.text}
          onChange={(e) => onChangeText(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Task name"
          spellCheck={false}
          style={{
            flex: 1,
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: 0,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.35,
            color: '#1f2933',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <div
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.35,
            color: el.text ? '#1f2933' : 'rgba(31,41,51,0.4)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflow: 'hidden',
          }}
        >
          {el.text || 'New task'}
        </div>
      )}
    </div>
  );
}
