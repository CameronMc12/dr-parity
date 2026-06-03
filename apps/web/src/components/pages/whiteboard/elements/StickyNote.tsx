'use client';

/**
 * A pastel sticky note. Renders its text (or a textarea while editing), an
 * optional status-accent bar along the top when seeded from a task, and a
 * folded corner. Plain presentational: drag/select/edit wiring lives in the
 * canvas via the props below.
 */

import { useEffect, useRef } from 'react';
import type { StickyElement } from '../types';

export function StickyNote({
  el,
  editing,
  onChangeText,
}: {
  el: StickyElement;
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
        position: 'relative',
        width: '100%',
        height: '100%',
        background: el.fill,
        borderRadius: 6,
        boxShadow: '0 6px 14px rgba(15,23,42,0.18)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {el.accent ? (
        <div
          style={{
            height: 6,
            width: '100%',
            background: el.accent,
            flexShrink: 0,
          }}
        />
      ) : null}
      {editing ? (
        <textarea
          ref={ref}
          value={el.text}
          onChange={(e) => onChangeText(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          spellCheck={false}
          style={{
            flex: 1,
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '10px 12px',
            fontSize: 14,
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
            padding: '10px 12px',
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.35,
            color: el.text ? '#1f2933' : 'rgba(31,41,51,0.4)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflow: 'hidden',
          }}
        >
          {el.text || 'Note'}
        </div>
      )}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: '0 0 16px 16px',
          borderColor: `transparent transparent rgba(0,0,0,0.08) transparent`,
        }}
      />
    </div>
  );
}
