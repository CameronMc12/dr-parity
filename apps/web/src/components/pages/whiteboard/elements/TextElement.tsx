'use client';

/**
 * Freeform text element. Shows its text, or a focused input while editing.
 * Transparent background so it reads as raw text on the canvas.
 */

import { useEffect, useRef } from 'react';
import type { TextElement as TextEl } from '../types';

export function TextElement({
  el,
  editing,
  onChangeText,
}: {
  el: TextEl;
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

  const shared: React.CSSProperties = {
    width: '100%',
    height: '100%',
    fontSize: el.size,
    fontWeight: 600,
    lineHeight: 1.25,
    color: el.color,
    fontFamily: 'inherit',
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={el.text}
        onChange={(e) => onChangeText(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        spellCheck={false}
        style={{
          ...shared,
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          padding: 2,
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...shared,
        padding: 2,
        color: el.text ? el.color : 'rgba(31,41,51,0.4)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'hidden',
      }}
    >
      {el.text || 'Text'}
    </div>
  );
}
